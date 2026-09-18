CREATE TABLE IF NOT EXISTS "SocketConversation" (
  "id" TEXT NOT NULL,
  "userAId" INTEGER NOT NULL,
  "userBId" INTEGER NOT NULL,
  "userAName" TEXT NOT NULL,
  "userBName" TEXT NOT NULL,
  "userAAvatarUrl" TEXT,
  "userBAvatarUrl" TEXT,
  "job" TEXT NOT NULL DEFAULT 'Direct message',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocketConversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SocketConversation_userAId_idx" ON "SocketConversation"("userAId");
CREATE INDEX IF NOT EXISTS "SocketConversation_userBId_idx" ON "SocketConversation"("userBId");

CREATE TABLE IF NOT EXISTS "SocketMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" INTEGER NOT NULL,
  "receiverId" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'text',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocketMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocketMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SocketConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SocketMessage_conversationId_idx" ON "SocketMessage"("conversationId");
CREATE INDEX IF NOT EXISTS "SocketMessage_senderId_idx" ON "SocketMessage"("senderId");
CREATE INDEX IF NOT EXISTS "SocketMessage_receiverId_idx" ON "SocketMessage"("receiverId");
