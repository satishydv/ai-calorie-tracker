CREATE TYPE "public"."activity_level" AS ENUM('sedentary', 'light', 'moderate', 'very');--> statement-breakpoint
CREATE TYPE "public"."diet_preference" AS ENUM('classic', 'keto', 'vegan', 'vegetarian');--> statement-breakpoint
CREATE TYPE "public"."goal" AS ENUM('lose', 'maintain', 'gain');--> statement-breakpoint
CREATE TYPE "public"."meal_status" AS ENUM('analyzing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."unit_preference" AS ENUM('metric', 'imperial');--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"status" "meal_status" DEFAULT 'analyzing' NOT NULL,
	"name" text,
	"calories" integer,
	"protein_g" integer,
	"carbs_g" integer,
	"fat_g" integer,
	"error_reason" text,
	"trigger_run_id" text,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text,
	"timezone" text,
	"unit_preference" "unit_preference",
	"gender" text,
	"date_of_birth" date,
	"height_cm" numeric,
	"weight_kg" numeric,
	"goal" "goal",
	"target_weight_kg" numeric,
	"activity_level" "activity_level",
	"pace_kg_per_week" numeric,
	"diet_preference" "diet_preference",
	"daily_calories" integer,
	"protein_g" integer,
	"carbs_g" integer,
	"fat_g" integer,
	"plan_rationale" text,
	"plan_generated_at" timestamp with time zone,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerkUserId_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meals_user_logged_at_idx" ON "meals" USING btree ("user_id","logged_at" DESC NULLS LAST);