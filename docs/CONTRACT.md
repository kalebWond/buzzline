# Buzzline game contract

Connect to the WebSocket at `/ws`. Every message is JSON with a `type`.
The server owns all game state and all scoring.

Players join at `/?code=ABCD`, where ABCD is the game code. The player screen fills in the code from that query parameter.

## Client messages
| type          | Fields         | Sent by | Allowed when                                                 |
|---------------|----------------|---------|--------------------------------------------------------------|
| host:create   |                | anyone  | Always. Sender becomes host                                  |
| player:join   | code, name     | anyone  | Lobby                                                        |
| player:rejoin | code, playerId | anyone  | Question, reveal or finished, while that player is disconnected |
| host:start    |                | host    | Lobby, with at least 1 player                                |
| player:answer | choice         | player  | Question                                                     |
| host:next     |                | host    | Reveal                                                       |

`choice` is the zero-based index of the chosen answer.

## Server messages
| type    | Fields               | Sent                                                 |
|---------|----------------------|------------------------------------------------------|
| welcome | role, playerId, code | Once, after create, join or rejoin. playerId is null for host |
| state   | state                | To everyone in the game, after every change          |
| error   | message              | To the sender only. The game state does not change   |

`role` is `"host"` or `"player"`. The sender gets `welcome` first, then `state`. Creating, joining and rejoining a game each count as a change.

`message` is always one of these exact strings:

| message                          | When                                                        |
|----------------------------------|-------------------------------------------------------------|
| Game not found                   | No game has that code                                       |
| Game already started             | player:join outside the lobby                               |
| Name must be 1 to 20 characters  | The trimmed name is empty or longer than 20 characters      |
| Name taken                       | Another player in the game has that name                    |
| Need at least 1 player           | host:start with no players                                  |
| Player not found                 | player:rejoin with a playerId that is not in that game      |
| Not allowed now                  | The sender's role or the current phase does not allow the message |
| Invalid message                  | The message is not valid JSON, or its type or fields are wrong |

## GameState
| Field         | Type                                | Notes                         |
|---------------|-------------------------------------|-------------------------------|
| code          | string                              | Four uppercase letters        |
| phase         | `"lobby"`, `"question"`, `"reveal"` or `"finished"` |               |
| players       | array of `{ id, name, score, answered }` | Sorted by score, high to low |
| questionIndex | number                              | Starts at 0                   |
| questionCount | number                              |                               |
| question      | `{ text: string, choices: string[] }`, or null | Null in lobby and finished |
| deadline      | epoch milliseconds, or null         | Set only during question      |
| correctIndex  | number or null                      | Set only during reveal        |

## Rules
- A game has five questions, kept in server/src/deck.ts.
- Every question has exactly four choices.
- Joining ignores the case of the code.
- Names are trimmed, 1 to 20 characters, and unique within a game.
- A question lasts 20 seconds. It ends early when every player has answered.
- The correct answer must never reach a client before the reveal phase.
- A correct answer scores 500 + round(500 x time left / 20 seconds). Otherwise 0.
- Scores change only when the game moves to reveal.
- A player's `answered` becomes true when they answer, stays true through the reveal, and goes back to false when the next question starts.
- Second answers and late answers are ignored.
- After the last question, host:next moves the game to finished.
- A player who disconnects in the lobby is removed. Later, they stay on the board.
- A player who disconnected after the lobby can send player:rejoin with the code and their playerId to take back their place.
- If the host disconnects, the game moves to finished.
- A socket that sends host:create while already in a game first leaves that game, exactly as if it had disconnected.
