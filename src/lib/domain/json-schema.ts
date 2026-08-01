import * as z from "zod";
import { ProjectBundleSchema } from "@/lib/domain/project";

export const PROJECT_BUNDLE_SCHEMA_ID =
  "https://generathon.local/schemas/project-bundle/1.0.0";

export const PROJECT_BUNDLE_JSON_SCHEMA = {
  $id: PROJECT_BUNDLE_SCHEMA_ID,
  ...z.toJSONSchema(ProjectBundleSchema, {
    target: "draft-2020-12",
  }),
};
