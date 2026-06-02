import logging
import re
from difflib import SequenceMatcher
from pathlib import Path

from .search import search

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent

GREETINGS = [
    "hi",
    "hello",
    "hey",
    "good morning",
    "good evening",
    "good afternoon",
]

THANKS = [
    "thanks",
    "thank you",
    "thx",
    "appreciate it",
]

GOODBYES = [
    "bye",
    "goodbye",
    "see you",
    "exit",
]

GENERAL_QUESTIONS = {
    "what can you do":
        "I can answer questions about Hawassa University academic rules, registration, exams, GPA, prerequisites, attendance, graduation, and student services.",
    "who are you":
        "I am a Hawassa University AI academic assistant designed to help students with university information.",
    "what do you know":
        "I know information related to registration, exams, prerequisites, GPA rules, graduation, attendance, add/drop, and university academic policies.",
    "help":
        "Try asking questions like:\n"
        "- What is registration?\n"
        "- What happens if I miss an exam?\n"
        "- How many ECTS can I take?\n"
        "- What is a prerequisite?\n"
        "- How is GPA calculated?",
}


def _normalize_query(text):
    return re.sub(r"\s+", " ", str(text or '').strip()).lower()


def _similarity(text_a, text_b):
    return SequenceMatcher(None, text_a, text_b).ratio()


def _is_greeting(query):
    normalized = _normalize_query(query)
    return any(greeting in normalized for greeting in GREETINGS)


def _is_thanks(query):
    normalized = _normalize_query(query)
    return any(thank in normalized for thank in THANKS)


def _is_goodbye(query):
    normalized = _normalize_query(query)
    return any(goodbye in normalized for goodbye in GOODBYES)


def _handle_general_questions(query):
    normalized = _normalize_query(query)
    best_match = None
    best_score = 0.0
    for pattern, answer in GENERAL_QUESTIONS.items():
        score = _similarity(normalized, pattern)
        if score > best_score:
            best_score = score
            best_match = answer
    return best_match if best_score >= 0.6 else None


def _build_response(results):
    if not results:
        return (
            "I do not have verified university information about that topic."
        )

    top = results[0]
    if isinstance(top, dict):
        metadata = top.get('metadata', {})
        doc_text = top.get('document', '')
        category = metadata.get('category', 'General')
        title = metadata.get('question', '')
        answer = '\n'.join([line for line in doc_text.splitlines() if line.strip().startswith('Answer:')])
        if answer:
            answer = answer.replace('Answer:', '').strip()
        else:
            answer = doc_text
        return (
            f"{answer}\n\n" 
            f"(Verified from Hawassa University knowledge base | category: {category})"
        )
    return "I do not have verified university information about that topic."


def _format_results(results):
    formatted = []
    for entry in results:
        formatted.append({
            'id': entry.get('id'),
            'score': entry.get('score'),
            'metadata': entry.get('metadata', {}),
            'document': entry.get('document', ''),
        })
    return formatted


def _split_multi_question(query):
    if not query:
        return []
    parts = re.split(r'[\?\!;]+| and | also | plus ', query)
    return [part.strip() for part in parts if part.strip()]


def ask(question, user_context=None):
    query = _normalize_query(question)
    if not query:
        return "I do not have verified university information about that topic."

    if _is_greeting(query):
        return (
            "Hello! I am your Hawassa University academic assistant. "
            "Ask me a question about academic policies, registration, exams, or student services."
        )

    if _is_thanks(query):
        return "You’re welcome! Feel free to ask another university-related question."

    if _is_goodbye(query):
        return "Goodbye! If you need more help, ask another question."

    general_response = _handle_general_questions(query)
    if general_response:
        return general_response

    fragments = _split_multi_question(query)
    search_queries = fragments if len(fragments) > 1 else [query]
    aggregate = {}
    for search_query in search_queries:
        results = search(search_query, top_k=5)
        for item in results:
            item_id = item.get('id')
            if not item_id:
                continue
            existing = aggregate.get(item_id)
            if not existing or item.get('score', 0) > existing.get('score', 0):
                aggregate[item_id] = item

    ranked = sorted(aggregate.values(), key=lambda r: r.get('score', 0), reverse=True)
    if not ranked or ranked[0].get('score', 0) < 0.2:
        return "I do not have verified university information about that topic."

    answer = _build_response(ranked)
    return answer


def chat():
    print("===================================")
    print(" Hawassa University AI Assistant")
    print("===================================")
    print("Type 'exit' to stop.\n")

    while True:
        query = input("Ask: ").strip()
        if not query:
            print("\nAssistant:")
            print("Please type a question.\n")
            continue

        if query.lower() == 'exit':
            print("\nAssistant:")
            print("Goodbye! Good luck with your studies.")
            break

        try:
            response = ask(query)
            print("\nAssistant:\n")
            print(response)
            print()
        except Exception:
            logger.exception('Unhandled error in chatbot')
            print("\nAssistant:")
            print("A server error occurred while processing your question. Please try again later.")
            print()


if __name__ == '__main__':
    chat()