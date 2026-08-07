-- Allow kanban cards that are not anchored to a chat message.
--
-- Until now every card was born from a message, so it always froze that message
-- and the bot's reply as its evidence. But not everything worth tracking starts
-- in a conversation — "add a FAQ about opening hours" has no dialog behind it.
--
-- The three message columns become nullable rather than being given empty-string
-- defaults: absent evidence and blank evidence are different things, and the UI
-- has to tell them apart to know whether to render the transcript block.

ALTER TABLE "playground_todos" ALTER COLUMN "dialogId" DROP NOT NULL;
ALTER TABLE "playground_todos" ALTER COLUMN "messageType" DROP NOT NULL;
ALTER TABLE "playground_todos" ALTER COLUMN "messageContent" DROP NOT NULL;
