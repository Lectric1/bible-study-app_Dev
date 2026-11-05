-- CreateTable
CREATE TABLE "timelines" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "default_chronology" TEXT NOT NULL,
    "year_start" INTEGER NOT NULL,
    "year_end" INTEGER NOT NULL,
    "black_and_white" BOOLEAN NOT NULL DEFAULT false,
    "active_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_nodes" (
    "id" TEXT NOT NULL,
    "timeline_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subtype" TEXT,
    "time_json" JSONB,
    "display_order" INTEGER,
    "roles_json" JSONB,
    "group" TEXT,
    "tags_json" JSONB,
    "terms_json" JSONB,
    "status" TEXT,
    "author_json" JSONB,
    "genre" TEXT,
    "events_described" TEXT,
    "trajectory" TEXT,
    "modern_name" TEXT,
    "coords_json" JSONB,
    "site_candidates_json" JSONB,
    "image" TEXT,
    "ref" TEXT,
    "source_json" JSONB,
    "confidence" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "timeline_nodes_pkey" PRIMARY KEY ("timeline_id", "id")
);

-- CreateTable
CREATE TABLE "timeline_edges" (
    "id" TEXT NOT NULL,
    "timeline_id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subtype" TEXT,
    "confidence" TEXT NOT NULL,
    "source_json" JSONB,
    "note" TEXT,
    "claim" TEXT,
    "color" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "timeline_edges_pkey" PRIMARY KEY ("timeline_id", "id")
);

-- CreateTable
CREATE TABLE "timeline_display_tracks" (
    "id" TEXT NOT NULL,
    "timeline_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "filter" TEXT NOT NULL,

    CONSTRAINT "timeline_display_tracks_pkey" PRIMARY KEY ("timeline_id", "id")
);

-- CreateTable
CREATE TABLE "timeline_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "nodes_json" JSONB NOT NULL,
    "edges_json" JSONB NOT NULL,
    "display_json" JSONB,
    "tags_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_user_preferences" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,

    CONSTRAINT "timeline_user_preferences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "timeline_user_preferences_key_key" UNIQUE ("key")
);

-- CreateIndex
CREATE INDEX "timeline_nodes_timeline_id_kind_idx" ON "timeline_nodes"("timeline_id", "kind");
CREATE INDEX "timeline_nodes_timeline_id_confidence_idx" ON "timeline_nodes"("timeline_id", "confidence");
CREATE INDEX "timeline_edges_timeline_id_from_id_idx" ON "timeline_edges"("timeline_id", "from_id");
CREATE INDEX "timeline_edges_timeline_id_to_id_idx" ON "timeline_edges"("timeline_id", "to_id");
CREATE INDEX "timeline_edges_timeline_id_kind_idx" ON "timeline_edges"("timeline_id", "kind");

-- AddForeignKey
ALTER TABLE "timeline_nodes" ADD CONSTRAINT "timeline_nodes_timeline_id_fkey"
    FOREIGN KEY ("timeline_id") REFERENCES "timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "timeline_edges" ADD CONSTRAINT "timeline_edges_timeline_id_fkey"
    FOREIGN KEY ("timeline_id") REFERENCES "timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "timeline_display_tracks" ADD CONSTRAINT "timeline_display_tracks_timeline_id_fkey"
    FOREIGN KEY ("timeline_id") REFERENCES "timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;   
