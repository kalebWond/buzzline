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

const science: DeckQuestion[] = [
  {
    text: "What is the chemical symbol for gold?",
    choices: ["Ag", "Au", "Gd", "Go"],
    correctIndex: 1,
  },
  {
    text: "What is the powerhouse of the cell?",
    choices: ["Nucleus", "Ribosome", "Mitochondrion", "Golgi body"],
    correctIndex: 2,
  },
  {
    text: "What is the closest star to Earth?",
    choices: ["The Sun", "Proxima Centauri", "Sirius", "Polaris"],
    correctIndex: 0,
  },
  {
    text: "What force keeps planets in orbit around the Sun?",
    choices: ["Magnetism", "Friction", "Static electricity", "Gravity"],
    correctIndex: 3,
  },
  {
    text: "Water boils at what temperature at sea level?",
    choices: ["90 C", "100 C", "110 C", "120 C"],
    correctIndex: 1,
  },
];

const geography: DeckQuestion[] = [
  {
    text: "What is the longest river in Africa?",
    choices: ["Nile", "Congo", "Niger", "Zambezi"],
    correctIndex: 0,
  },
  {
    text: "Which country has the largest population?",
    choices: ["United States", "Indonesia", "India", "Brazil"],
    correctIndex: 2,
  },
  {
    text: "What is the capital of Canada?",
    choices: ["Toronto", "Vancouver", "Montreal", "Ottawa"],
    correctIndex: 3,
  },
  {
    text: "Which is the largest ocean?",
    choices: ["Atlantic", "Pacific", "Indian", "Arctic"],
    correctIndex: 1,
  },
  {
    text: "Mount Kilimanjaro is in which country?",
    choices: ["Kenya", "Ethiopia", "Tanzania", "Uganda"],
    correctIndex: 2,
  },
];

export const decks: Record<string, DeckQuestion[]> = { classic: deck, science, geography };
