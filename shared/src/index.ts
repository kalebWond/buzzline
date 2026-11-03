export const APP_NAME = "buzzline";

export const QUESTION_SECONDS = 20;

export type Phase = "lobby" | "question" | "reveal" | "finished";

export interface PlayerView {
  id: string;
  name: string;
  score: number;
  answered: boolean;
  streak: number;
}

export interface QuestionView {
  text: string;
  choices: string[];
}

export interface GameState {
  code: string;
  phase: Phase;
  players: PlayerView[];
  questionIndex: number;
  questionCount: number;
  question: QuestionView | null;
  deadline: number | null;
  correctIndex: number | null;
  answerCounts: number[] | null;
}

export const DECKS = [
  { id: "classic", name: "Classic" },
  { id: "science", name: "Science" },
  { id: "geography", name: "Geography" },
] as const;

export type DeckId = (typeof DECKS)[number]["id"];

export const DEFAULT_DECK_ID: DeckId = "classic";

export const STREAK_LENGTH = 3;
export const STREAK_BONUS = 200;

export type ClientMessage =
  | { type: "host:create"; deckId?: DeckId }
  | { type: "player:join"; code: string; name: string }
  | { type: "player:rejoin"; code: string; playerId: string }
  | { type: "host:start" }
  | { type: "player:answer"; choice: number }
  | { type: "host:next" }
  | { type: "host:kick"; playerId: string };

export type ServerMessage =
  | { type: "welcome"; role: "host" | "player"; playerId: string | null; code: string }
  | { type: "state"; state: GameState }
  | { type: "error"; message: string }
  | { type: "kicked" };
