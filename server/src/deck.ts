export interface DeckQuestion {
  text: string;
  choices: [string, string, string, string];
  correctIndex: number;
}

export const deck: DeckQuestion[] = [
  {
    text: "Which planet is known as the Red Planet?",
    choices: ["Venus", "Mars", "Jupiter", "Mercury"],
    correctIndex: 1,
  },
  {
    text: "What is the capital of Australia?",
    choices: ["Sydney", "Melbourne", "Canberra", "Perth"],
    correctIndex: 2,
  },
  {
    text: "How many sides does a hexagon have?",
    choices: ["5", "6", "7", "8"],
    correctIndex: 1,
  },
  {
    text: "Which gas do plants absorb from the air?",
    choices: ["Oxygen", "Nitrogen", "Helium", "Carbon dioxide"],
    correctIndex: 3,
  },
  {
    text: "Who painted the Mona Lisa?",
    choices: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Van Gogh"],
    correctIndex: 0,
  },
];
