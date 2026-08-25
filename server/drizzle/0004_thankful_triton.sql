CREATE TABLE "storage_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(20) NOT NULL,
	"bucket" varchar(255) NOT NULL,
	"object_key" text NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"content_type" varchar(255) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"visibility" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"etag" varchar(255),
	"created_by" uuid,
	"uploaded_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_objects_provider_check" CHECK ("storage_objects"."provider" in ('local', 's3')),
	CONSTRAINT "storage_objects_visibility_check" CHECK ("storage_objects"."visibility" in ('public', 'private')),
	CONSTRAINT "storage_objects_status_check" CHECK ("storage_objects"."status" in ('pending', 'ready', 'deleted')),
	CONSTRAINT "storage_objects_size_check" CHECK ("storage_objects"."size_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "storage_objects" ADD CONSTRAINT "storage_objects_created_by_identity_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."identity_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "storage_objects_provider_key_unique" ON "storage_objects" USING btree ("provider","bucket","object_key");--> statement-breakpoint
CREATE INDEX "storage_objects_status_created_idx" ON "storage_objects" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "storage_objects_created_by_idx" ON "storage_objects" USING btree ("created_by","created_at");