import { ApiError, apiFetch } from "../lib/api";
import { ChatMessage } from "../types";

export async function getAcademicAdvice(query: string, history: ChatMessage[]) {
  try {
    const recentHistory = history.slice(-6);
    const conversationContext = recentHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`)
      .join('\n');

    // Combine context with current query
    const fullQuestion = conversationContext
      ? `${conversationContext}\nUser: ${query}`
      : query;

    const response = await apiFetch<{ answer: string }>('/api/ask-ai/', {
      method: 'POST',
      body: { question: fullQuestion },
    });

    if (response.status === 'success' && response.data?.answer) {
      return response.data.answer;
    }

    return response.message || "I'm sorry, I couldn't provide advice at this time.";
  } catch (error) {
    if (error instanceof ApiError && error.message) {
      return error.message;
    }
    return "I'm having trouble connecting to the advisory service. Please try again later or contact your department advisor.";
  }
}
