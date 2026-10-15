import { NextRequest, NextResponse } from "next/server";
import { chatMessageSchema } from "@/lib/validation/schemas";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { AIConversation, AIMessage } from "@/lib/db/models";
import { sendGroqChat, GroqServiceError, DEFAULT_GROQ_MODEL } from "@/lib/ai/groq";
import { answerGroundedQuery } from "@/lib/ai/rag";
import { logActivity } from "@/lib/workspace/auth";

export async function POST(req: NextRequest) {
  // 1. Require authentication
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized: Please sign in to access AI Knowledge" },
      { status: 401 }
    );
  }

  // 2. Validate input
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const parseResult = chatMessageSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { conversationId, message, model, mode = "general", documentIds } = parseResult.data;
  const targetModel = model || DEFAULT_GROQ_MODEL;

  try {
    await connectToDatabase();

    let currentConversation: { id: string; title: string };

    // 3. Resolve or create conversation with strict workspace validation
    if (conversationId) {
      const existingConv = await AIConversation.findOne({
        _id: conversationId,
        workspaceId: session.workspaceId,
      });

      if (!existingConv) {
        return NextResponse.json(
          { error: "Conversation not found or not accessible within this workspace" },
          { status: 404 }
        );
      }
      currentConversation = {
        id: existingConv.id,
        title: existingConv.title,
      };
    } else {
      // Generate initial title from first message
      const generatedTitle =
        message.length > 40 ? `${message.substring(0, 37)}...` : message;

      const createdConv = await AIConversation.create({
        workspaceId: session.workspaceId,
        userId: session.userId,
        title: generatedTitle,
      });

      currentConversation = {
        id: createdConv.id,
        title: createdConv.title,
      };
    }

    // 4. Fetch prior messages for context
    const previousMessages = await AIMessage.find({
      conversationId: currentConversation.id,
    })
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    const conversationHistory = previousMessages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Add current user message
    conversationHistory.push({
      role: "user",
      content: message,
    });

    // 5. Persist user message to MongoDB AIMessages collection
    const userMessageRecord = await AIMessage.create({
      conversationId: currentConversation.id,
      role: "user",
      content: message,
    });

    // 6. Branch: Grounded RAG vs General Chat
    let assistantContent = "";
    let assistantModel = targetModel;
    let citations: any[] = [];
    let usage: any = undefined;

    if (mode === "rag") {
      try {
        const ragResult = await answerGroundedQuery({
          workspaceId: session.workspaceId,
          query: message,
          documentIds,
          conversationHistory: conversationHistory.slice(0, -1),
        });

        assistantContent = ragResult.answer;
        assistantModel = ragResult.model;
        citations = ragResult.citations;
      } catch (ragError: any) {
        console.error("RAG grounding error:", ragError);
        return NextResponse.json(
          {
            error: ragError.message || "Failed to retrieve and ground answer in documents.",
            conversationId: currentConversation.id,
            userMessageId: userMessageRecord.id,
          },
          { status: 500 }
        );
      }
    } else {
      // General Groq AI Chat
      try {
        const aiResponse = await sendGroqChat({
          messages: conversationHistory,
          model: targetModel,
        });

        assistantContent = aiResponse.content;
        assistantModel = aiResponse.model;
        usage = {
          promptTokens: aiResponse.promptTokens,
          completionTokens: aiResponse.completionTokens,
          totalTokens: aiResponse.totalTokens,
        };
      } catch (aiError: any) {
        console.error("Groq provider error in chat endpoint:", aiError);

        const status = aiError instanceof GroqServiceError ? aiError.statusCode : 500;
        const code = aiError instanceof GroqServiceError ? aiError.code : "AI_ERROR";
        const message =
          aiError instanceof GroqServiceError
            ? aiError.message
            : "An error occurred while contacting the AI provider. Please check your Gemini API configuration.";

        return NextResponse.json(
          {
            error: message,
            code,
            conversationId: currentConversation.id,
            userMessageId: userMessageRecord.id,
          },
          { status }
        );
      }
    }

    // 7. Persist successful assistant response to AIMessages collection
    const assistantMessageRecord = await AIMessage.create({
      conversationId: currentConversation.id,
      role: "assistant",
      content: assistantContent,
      modelId: assistantModel,
      citations: citations.length > 0 ? citations : undefined,
    });

    // Update conversation timestamp
    await AIConversation.updateOne(
      { _id: currentConversation.id },
      { $set: { updatedAt: new Date() } }
    );

    // 8. Log activity
    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: mode === "rag" ? "RAG_QUERY_EXECUTED" : "CHAT_MESSAGE_SENT",
      resourceType: "CONVERSATION",
      resourceId: currentConversation.id,
      metadata: {
        model: assistantModel,
        mode,
        citationsCount: citations.length,
      },
    });

    return NextResponse.json({
      conversationId: currentConversation.id,
      conversationTitle: currentConversation.title,
      userMessage: {
        id: userMessageRecord.id,
        role: "user",
        content: userMessageRecord.content,
        createdAt: userMessageRecord.createdAt,
      },
      assistantMessage: {
        id: assistantMessageRecord.id,
        role: "assistant",
        content: assistantMessageRecord.content,
        modelId: assistantMessageRecord.modelId,
        citations: assistantMessageRecord.citations,
        createdAt: assistantMessageRecord.createdAt,
      },
      usage,
    });
  } catch (error: any) {
    console.error("Chat endpoint general error:", error);
    return NextResponse.json(
      { error: "Internal server error occurred while processing chat request." },
      { status: 500 }
    );
  }
}
