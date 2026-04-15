# AGENTS.md

in this project we do test driven development, so write tests before writing the code, and make sure all tests pass before moving on to the next feature.
tests should be next to the code they are testing, so `x.ts` should have its tests in `x.test.ts` in the same directory.

it is a mono repo so everything is in one repository, including lore, design documents, code, tests, and any other relevant materials.

Architecture is very important, so we should spend time designing the architecture before writing code. We should also document the architecture in a way that is easy to understand and maintain.

Split out the code in smaller parts and make sure each part has a clear responsibility. This will make it easier to test and maintain the code.

There should be a clear separation between the client and the server. The server needs to keep track of the full game state and calculate all the changes that are happening, while the client is just there to be a fancy renderer that displays the current game state. So the client should not keep track of any of the game state and should send all actions to the server to be processed.

For every change made to the project, there should be extra documentation that describes the decisions that were made during the implementation so that we can keep track of the changes and the decisions made.
