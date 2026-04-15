-- CreateIndex
CREATE INDEX "ai_analyses_project_id_type_input_hash_idx" ON "ai_analyses"("project_id", "type", "input_hash");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE INDEX "visit_ratings_user_id_idx" ON "visit_ratings"("user_id");
