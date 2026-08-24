CREATE TABLE "job_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"worker_id" varchar(200) NOT NULL,
	"outcome" varchar(20) DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "job_attempts_attempt_check" CHECK ("job_attempts"."attempt" > 0),
	CONSTRAINT "job_attempts_generation_check" CHECK ("job_attempts"."generation" > 0),
	CONSTRAINT "job_attempts_outcome_check" CHECK ("job_attempts"."outcome" in ('running', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(120) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"idempotency_key" varchar(200),
	"locked_by" varchar(200),
	"locked_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_status_check" CHECK ("jobs"."status" in ('pending', 'running', 'succeeded', 'dead')),
	CONSTRAINT "jobs_attempts_check" CHECK ("jobs"."attempts" >= 0 and "jobs"."attempts" <= "jobs"."max_attempts"),
	CONSTRAINT "jobs_max_attempts_check" CHECK ("jobs"."max_attempts" > 0),
	CONSTRAINT "jobs_generation_check" CHECK ("jobs"."generation" > 0),
	CONSTRAINT "jobs_lock_state_check" CHECK (("jobs"."status" = 'running' and "jobs"."locked_by" is not null and "jobs"."locked_at" is not null and "jobs"."heartbeat_at" is not null) or ("jobs"."status" <> 'running' and "jobs"."locked_by" is null and "jobs"."locked_at" is null and "jobs"."heartbeat_at" is null))
);
--> statement-breakpoint
CREATE TABLE "mail_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"idempotency_key" varchar(200),
	"recipient" varchar(320) NOT NULL,
	"template" varchar(80) NOT NULL,
	"subject" varchar(300) NOT NULL,
	"text_body" text NOT NULL,
	"html_body" text,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"simulated" varchar(5) DEFAULT 'false' NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_deliveries_status_check" CHECK ("mail_deliveries"."status" in ('queued', 'sent', 'failed')),
	CONSTRAINT "mail_deliveries_simulated_check" CHECK ("mail_deliveries"."simulated" in ('true', 'false'))
);
--> statement-breakpoint
CREATE TABLE "notification_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"category" varchar(80) NOT NULL,
	"level" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"cta_url" text,
	"dedupe_key" varchar(200),
	"created_by" uuid,
	"outbox_event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"category" varchar(80) NOT NULL,
	"level" varchar(20) DEFAULT 'info' NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"cta_url" text,
	"dedupe_key" varchar(200),
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_level_check" CHECK ("notifications"."level" in ('info', 'success', 'warning', 'error'))
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(120) NOT NULL,
	"aggregate_type" varchar(120),
	"aggregate_id" varchar(200),
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 10 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_by" varchar(200),
	"locked_at" timestamp with time zone,
	"dedupe_key" varchar(200),
	"last_error" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_status_check" CHECK ("outbox_events"."status" in ('pending', 'processing', 'published', 'dead')),
	CONSTRAINT "outbox_events_attempts_check" CHECK ("outbox_events"."attempts" >= 0 and "outbox_events"."attempts" <= "outbox_events"."max_attempts"),
	CONSTRAINT "outbox_events_max_attempts_check" CHECK ("outbox_events"."max_attempts" > 0),
	CONSTRAINT "outbox_events_lock_state_check" CHECK (("outbox_events"."status" = 'processing' and "outbox_events"."locked_by" is not null and "outbox_events"."locked_at" is not null) or ("outbox_events"."status" <> 'processing' and "outbox_events"."locked_by" is null and "outbox_events"."locked_at" is null))
);
--> statement-breakpoint
ALTER TABLE "job_attempts" ADD CONSTRAINT "job_attempts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_deliveries" ADD CONSTRAINT "mail_deliveries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_announcements" ADD CONSTRAINT "notification_announcements_recipient_user_id_identity_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."identity_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_announcements" ADD CONSTRAINT "notification_announcements_created_by_identity_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."identity_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_announcements" ADD CONSTRAINT "notification_announcements_outbox_event_id_outbox_events_id_fk" FOREIGN KEY ("outbox_event_id") REFERENCES "public"."outbox_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_identity_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."identity_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_attempts_job_generation_attempt_unique" ON "job_attempts" USING btree ("job_id","generation","attempt");--> statement-breakpoint
CREATE INDEX "job_attempts_job_idx" ON "job_attempts" USING btree ("job_id","started_at");--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("status","run_at","priority");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "jobs" USING btree ("type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_idempotency_key_unique" ON "jobs" USING btree ("idempotency_key") WHERE "jobs"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "mail_deliveries_status_idx" ON "mail_deliveries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "mail_deliveries_job_idx" ON "mail_deliveries" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mail_deliveries_idempotency_key_unique" ON "mail_deliveries" USING btree ("idempotency_key") WHERE "mail_deliveries"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_announcements_outbox_unique" ON "notification_announcements" USING btree ("outbox_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_announcements_dedupe_unique" ON "notification_announcements" USING btree ("dedupe_key") WHERE "notification_announcements"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications" USING btree ("recipient_user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_recipient_dedupe_unique" ON "notifications" USING btree ("recipient_user_id","dedupe_key") WHERE "notifications"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX "outbox_events_claim_idx" ON "outbox_events" USING btree ("status","available_at","created_at");--> statement-breakpoint
CREATE INDEX "outbox_events_topic_idx" ON "outbox_events" USING btree ("topic","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_events_dedupe_key_unique" ON "outbox_events" USING btree ("dedupe_key") WHERE "outbox_events"."dedupe_key" is not null;