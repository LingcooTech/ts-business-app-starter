CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" varchar(20) NOT NULL,
	"actor_id" varchar(200),
	"action" varchar(120) NOT NULL,
	"resource_type" varchar(120) NOT NULL,
	"resource_id" varchar(200),
	"outcome" varchar(20) NOT NULL,
	"request_id" varchar(200),
	"ip_address" varchar(64),
	"user_agent" varchar(512),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "audit_logs_actor_type_check" CHECK ("audit_logs"."actor_type" in ('user', 'system', 'job')),
	CONSTRAINT "audit_logs_outcome_check" CHECK ("audit_logs"."outcome" in ('success', 'failure'))
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"value_json" jsonb,
	"encrypted_value" jsonb,
	"key_id" varchar(120),
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_value_storage_check" CHECK ((("system_settings"."value_json" is not null)::int + ("system_settings"."encrypted_value" is not null)::int) = 1),
	CONSTRAINT "system_settings_encryption_key_check" CHECK (("system_settings"."encrypted_value" is null and "system_settings"."key_id" is null) or ("system_settings"."encrypted_value" is not null and "system_settings"."key_id" is not null)),
	CONSTRAINT "system_settings_version_check" CHECK ("system_settings"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_identity_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."identity_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs" USING btree ("request_id");
--> statement-breakpoint
CREATE FUNCTION reject_audit_log_mutation() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_logs_immutable
	BEFORE UPDATE OR DELETE ON "audit_logs"
	FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();
