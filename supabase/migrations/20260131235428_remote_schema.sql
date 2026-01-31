drop extension if exists "pg_net";


  create table "public"."my_plants_dim" (
    "plant_id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "species_id" uuid,
    "nickname" text,
    "location_of_plant" text,
    "soil_brand" text,
    "pot_size_in" numeric,
    "pot_size_cm" numeric,
    "origin_type" text,
    "active_start_date" date default CURRENT_DATE,
    "is_active" boolean default true,
    "archived_date" date
      );


alter table "public"."my_plants_dim" enable row level security;


  create table "public"."plant_facts" (
    "fact_id" uuid not null default gen_random_uuid(),
    "plant_id" uuid,
    "event_timestamp" timestamp with time zone default now(),
    "event_type" text,
    "note_text" text,
    "plant_height_cm" numeric,
    "plant_height_in" numeric,
    "image_url" text
      );


alter table "public"."plant_facts" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "full_name" text,
    "location_city" text,
    "location_state" text,
    "unit_preference" text default 'imperial'::text,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."profiles" enable row level security;


  create table "public"."species_dim" (
    "species_id" uuid not null default gen_random_uuid(),
    "scientific_name" text not null,
    "common_name" text,
    "typical_watering_frequency_days" integer,
    "light_requirements" text,
    "is_toxic_to_cats" boolean default false,
    "is_toxic_to_dogs" boolean default false,
    "additional_tips" text
      );


alter table "public"."species_dim" enable row level security;

CREATE UNIQUE INDEX my_plants_dim_pkey ON public.my_plants_dim USING btree (plant_id);

CREATE UNIQUE INDEX plant_facts_pkey ON public.plant_facts USING btree (fact_id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX species_dim_pkey ON public.species_dim USING btree (species_id);

CREATE UNIQUE INDEX species_dim_scientific_name_key ON public.species_dim USING btree (scientific_name);

alter table "public"."my_plants_dim" add constraint "my_plants_dim_pkey" PRIMARY KEY using index "my_plants_dim_pkey";

alter table "public"."plant_facts" add constraint "plant_facts_pkey" PRIMARY KEY using index "plant_facts_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."species_dim" add constraint "species_dim_pkey" PRIMARY KEY using index "species_dim_pkey";

alter table "public"."my_plants_dim" add constraint "my_plants_dim_origin_type_check" CHECK ((origin_type = ANY (ARRAY['propagated'::text, 'seed'::text, 'purchased_gifted'::text]))) not valid;

alter table "public"."my_plants_dim" validate constraint "my_plants_dim_origin_type_check";

alter table "public"."my_plants_dim" add constraint "my_plants_dim_species_id_fkey" FOREIGN KEY (species_id) REFERENCES public.species_dim(species_id) not valid;

alter table "public"."my_plants_dim" validate constraint "my_plants_dim_species_id_fkey";

alter table "public"."my_plants_dim" add constraint "my_plants_dim_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."my_plants_dim" validate constraint "my_plants_dim_user_id_fkey";

alter table "public"."plant_facts" add constraint "plant_facts_event_type_check" CHECK ((event_type = ANY (ARRAY['watered'::text, 'fertilized'::text, 'replanted'::text, 'noted'::text, 'measured'::text, 'health_issue'::text]))) not valid;

alter table "public"."plant_facts" validate constraint "plant_facts_event_type_check";

alter table "public"."plant_facts" add constraint "plant_facts_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES public.my_plants_dim(plant_id) ON DELETE CASCADE not valid;

alter table "public"."plant_facts" validate constraint "plant_facts_plant_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_unit_preference_check" CHECK ((unit_preference = ANY (ARRAY['metric'::text, 'imperial'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_unit_preference_check";

alter table "public"."species_dim" add constraint "species_dim_scientific_name_key" UNIQUE using index "species_dim_scientific_name_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_unit_conversions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- --- HEIGHT CONVERSION (in plant_facts) ---
  IF TG_TABLE_NAME = 'plant_facts' THEN
    -- Calculate In from CM
    IF (NEW.plant_height_cm IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.plant_height_cm IS DISTINCT FROM OLD.plant_height_cm)) THEN
      NEW.plant_height_in := NEW.plant_height_cm * 0.393701;
    -- Calculate CM from In
    ELSIF (NEW.plant_height_in IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.plant_height_in IS DISTINCT FROM OLD.plant_height_in)) THEN
      NEW.plant_height_cm := NEW.plant_height_in * 2.54;
    END IF;
  END IF;

  -- --- POT SIZE CONVERSION (in my_plants_dim) ---
  IF TG_TABLE_NAME = 'my_plants_dim' THEN
    -- Calculate In from CM
    IF (NEW.pot_size_cm IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.pot_size_cm IS DISTINCT FROM OLD.pot_size_cm)) THEN
      NEW.pot_size_in := NEW.pot_size_cm * 0.393701;
    -- Calculate CM from In
    ELSIF (NEW.pot_size_in IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.pot_size_in IS DISTINCT FROM OLD.pot_size_in)) THEN
      NEW.pot_size_cm := NEW.pot_size_in * 2.54;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

grant delete on table "public"."my_plants_dim" to "anon";

grant insert on table "public"."my_plants_dim" to "anon";

grant references on table "public"."my_plants_dim" to "anon";

grant select on table "public"."my_plants_dim" to "anon";

grant trigger on table "public"."my_plants_dim" to "anon";

grant truncate on table "public"."my_plants_dim" to "anon";

grant update on table "public"."my_plants_dim" to "anon";

grant delete on table "public"."my_plants_dim" to "authenticated";

grant insert on table "public"."my_plants_dim" to "authenticated";

grant references on table "public"."my_plants_dim" to "authenticated";

grant select on table "public"."my_plants_dim" to "authenticated";

grant trigger on table "public"."my_plants_dim" to "authenticated";

grant truncate on table "public"."my_plants_dim" to "authenticated";

grant update on table "public"."my_plants_dim" to "authenticated";

grant delete on table "public"."my_plants_dim" to "service_role";

grant insert on table "public"."my_plants_dim" to "service_role";

grant references on table "public"."my_plants_dim" to "service_role";

grant select on table "public"."my_plants_dim" to "service_role";

grant trigger on table "public"."my_plants_dim" to "service_role";

grant truncate on table "public"."my_plants_dim" to "service_role";

grant update on table "public"."my_plants_dim" to "service_role";

grant delete on table "public"."plant_facts" to "anon";

grant insert on table "public"."plant_facts" to "anon";

grant references on table "public"."plant_facts" to "anon";

grant select on table "public"."plant_facts" to "anon";

grant trigger on table "public"."plant_facts" to "anon";

grant truncate on table "public"."plant_facts" to "anon";

grant update on table "public"."plant_facts" to "anon";

grant delete on table "public"."plant_facts" to "authenticated";

grant insert on table "public"."plant_facts" to "authenticated";

grant references on table "public"."plant_facts" to "authenticated";

grant select on table "public"."plant_facts" to "authenticated";

grant trigger on table "public"."plant_facts" to "authenticated";

grant truncate on table "public"."plant_facts" to "authenticated";

grant update on table "public"."plant_facts" to "authenticated";

grant delete on table "public"."plant_facts" to "service_role";

grant insert on table "public"."plant_facts" to "service_role";

grant references on table "public"."plant_facts" to "service_role";

grant select on table "public"."plant_facts" to "service_role";

grant trigger on table "public"."plant_facts" to "service_role";

grant truncate on table "public"."plant_facts" to "service_role";

grant update on table "public"."plant_facts" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."species_dim" to "anon";

grant insert on table "public"."species_dim" to "anon";

grant references on table "public"."species_dim" to "anon";

grant select on table "public"."species_dim" to "anon";

grant trigger on table "public"."species_dim" to "anon";

grant truncate on table "public"."species_dim" to "anon";

grant update on table "public"."species_dim" to "anon";

grant delete on table "public"."species_dim" to "authenticated";

grant insert on table "public"."species_dim" to "authenticated";

grant references on table "public"."species_dim" to "authenticated";

grant select on table "public"."species_dim" to "authenticated";

grant trigger on table "public"."species_dim" to "authenticated";

grant truncate on table "public"."species_dim" to "authenticated";

grant update on table "public"."species_dim" to "authenticated";

grant delete on table "public"."species_dim" to "service_role";

grant insert on table "public"."species_dim" to "service_role";

grant references on table "public"."species_dim" to "service_role";

grant select on table "public"."species_dim" to "service_role";

grant trigger on table "public"."species_dim" to "service_role";

grant truncate on table "public"."species_dim" to "service_role";

grant update on table "public"."species_dim" to "service_role";


  create policy "Users can manage own plants"
  on "public"."my_plants_dim"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "Users can manage own facts"
  on "public"."plant_facts"
  as permissive
  for all
  to public
using ((plant_id IN ( SELECT my_plants_dim.plant_id
   FROM public.my_plants_dim
  WHERE (my_plants_dim.user_id = auth.uid()))));



  create policy "Users can manage own profile"
  on "public"."profiles"
  as permissive
  for all
  to public
using ((auth.uid() = id));



  create policy "Species are readable by all"
  on "public"."species_dim"
  as permissive
  for select
  to public
using (true);


CREATE TRIGGER tr_convert_pot_size BEFORE INSERT OR UPDATE ON public.my_plants_dim FOR EACH ROW EXECUTE FUNCTION public.handle_unit_conversions();

CREATE TRIGGER tr_convert_height BEFORE INSERT OR UPDATE ON public.plant_facts FOR EACH ROW EXECUTE FUNCTION public.handle_unit_conversions();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


