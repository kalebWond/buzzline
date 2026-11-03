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
      { id: "p1", name: "Ada", score: 0, answered: false, streak: 0 },
      { id: "p2", name: "Linus", score: 0, answered: false, streak: 0 },
    ],
    questionIndex: 0,
    questionCount: 5,
    question: null,
    deadline: null,
    correctIndex: null,
    answerCounts: null,
    autoAdvance: false,
    nextAt: null,
  },
  question: {
    code: "ABCD",
    phase: "question",
    players: [
      { id: "p1", name: "Ada", score: 0, answered: true, streak: 0 },
      { id: "p2", name: "Linus", score: 0, answered: false, streak: 0 },
    ],
    questionIndex: 0,
    questionCount: 5,
    question,
    deadline: 1_700_000_020_000,
    correctIndex: null,
    answerCounts: null,
    autoAdvance: false,
    nextAt: null,
  },
  reveal: {
    code: "ABCD",
    phase: "reveal",
    players: [
      { id: "p1", name: "Ada", score: 900, answered: true, streak: 1 },
      { id: "p2", name: "Linus", score: 0, answered: true, streak: 0 },
    ],
    questionIndex: 0,
    questionCount: 5,
    question,
    deadline: null,
    correctIndex: 1,
    answerCounts: [0, 1, 0, 1],
    autoAdvance: false,
    nextAt: null,
  },
  finished: {
    code: "ABCD",
    phase: "finished",
    players: [
      { id: "p1", name: "Ada", score: 3800, answered: true, streak: 3 },
      { id: "p2", name: "Linus", score: 2100, answered: true, streak: 0 },
    ],
    questionIndex: 4,
    questionCount: 5,
    question: null,
    deadline: null,
    correctIndex: null,
    answerCounts: null,
    autoAdvance: false,
    nextAt: null,
  },
};
