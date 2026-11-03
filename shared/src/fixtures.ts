import type { GameState, Phase, QuestionView } from "./index.js";

const question: QuestionView = {
  text: "Which planet is closest to the sun?",
  choices: ["Venus", "Mercury", "Earth", "Mars"],
};

export const fixtures: Record<Phase, GameState> = {
  lobby: {
    code: "ABCD",
    phase: "lobby",
    players: [
      { id: "p1", name: "Ada", score: 0, answered: false },
      { id: "p2", name: "Linus", score: 0, answered: false },
    ],
    questionIndex: 0,
    questionCount: 5,
    question: null,
    deadline: null,
    correctIndex: null,
    answerCounts: null,
  },
  question: {
    code: "ABCD",
    phase: "question",
    players: [
      { id: "p1", name: "Ada", score: 0, answered: true },
      { id: "p2", name: "Linus", score: 0, answered: false },
    ],
    questionIndex: 0,
    questionCount: 5,
    question,
    deadline: 1_700_000_020_000,
    correctIndex: null,
    answerCounts: null,
  },
  reveal: {
    code: "ABCD",
    phase: "reveal",
    players: [
      { id: "p1", name: "Ada", score: 900, answered: true },
      { id: "p2", name: "Linus", score: 0, answered: true },
    ],
    questionIndex: 0,
    questionCount: 5,
    question,
    deadline: null,
    correctIndex: 1,
    answerCounts: [0, 1, 0, 1],
  },
  finished: {
    code: "ABCD",
    phase: "finished",
    players: [
      { id: "p1", name: "Ada", score: 3800, answered: true },
      { id: "p2", name: "Linus", score: 2100, answered: true },
    ],
    questionIndex: 4,
    questionCount: 5,
    question: null,
    deadline: null,
    correctIndex: null,
    answerCounts: null,
  },
};
