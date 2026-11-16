-- CreateTable
CREATE TABLE "Timeline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "defaultChronology" TEXT NOT NULL DEFAULT 'thiele',
    "yearStart" INTEGER NOT NULL,
    "yearEnd" INTEGER NOT NULL,
    "blackAndWhite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineNode" (
    "id" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subtype" TEXT,
    "time" JSONB,
    "displayOrder" INTEGER,
    "roles" JSONB,
    "group" TEXT,
    "tags" JSONB,
    "terms" JSONB,
    "status" TEXT,
    "author" JSONB,
    "genre" TEXT,
    "eventsDescribed" TEXT,
    "trajectory" TEXT,
    "modernName" TEXT,
    "coords" JSONB,
    "siteCandidates" JSONB,
    "image" TEXT,
    "ref" TEXT,
    "source" JSONB,
    "confidence" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "TimelineNode_pkey" PRIMARY KEY ("timelineId","id")
);

-- CreateTable
CREATE TABLE "TimelineEdge" (
    "id" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subtype" TEXT,
    "confidence" TEXT NOT NULL,
    "source" JSONB,
    "note" TEXT,
    "claim" TEXT,
    "color" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TimelineEdge_pkey" PRIMARY KEY ("timelineId","id")
);

-- CreateTable
CREATE TABLE "TimelineDisplayTrack" (
    "id" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "filter" TEXT NOT NULL,

    CONSTRAINT "TimelineDisplayTrack_pkey" PRIMARY KEY ("timelineId","id")
);

-- CreateTable
CREATE TABLE "TimelineShare" (
    "id" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "display" JSONB,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineUserPreference" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,

    CONSTRAINT "TimelineUserPreference_pkey" PRIMARY KEY ("userId","key")
);

-- CreateIndex
CREATE INDEX "Timeline_userId_idx" ON "Timeline"("userId");

-- CreateIndex
CREATE INDEX "TimelineNode_timelineId_kind_idx" ON "TimelineNode"("timelineId", "kind");
CREATE INDEX "TimelineNode_timelineId_group_idx" ON "TimelineNode"("timelineId", "group");
CREATE INDEX "TimelineNode_timelineId_confidence_idx" ON "TimelineNode"("timelineId", "confidence");

-- CreateIndex
CREATE INDEX "TimelineEdge_timelineId_fromId_idx" ON "TimelineEdge"("timelineId", "fromId");
CREATE INDEX "TimelineEdge_timelineId_toId_idx" ON "TimelineEdge"("timelineId", "toId");
CREATE INDEX "TimelineEdge_timelineId_kind_idx" ON "TimelineEdge"("timelineId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineShare_timelineId_userId_key" ON "TimelineShare"("timelineId", "userId");
CREATE INDEX "TimelineShare_userId_idx" ON "TimelineShare"("userId");

-- CreateIndex
CREATE INDEX "TimelineTemplate_userId_idx" ON "TimelineTemplate"("userId");

-- AddForeignKey
ALTER TABLE "Timeline" ADD CONSTRAINT "Timeline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineNode" ADD CONSTRAINT "TimelineNode_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEdge" ADD CONSTRAINT "TimelineEdge_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineDisplayTrack" ADD CONSTRAINT "TimelineDisplayTrack_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineShare" ADD CONSTRAINT "TimelineShare_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineShare" ADD CONSTRAINT "TimelineShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineTemplate" ADD CONSTRAINT "TimelineTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineUserPreference" ADD CONSTRAINT "TimelineUserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;   
