import { consolePreviewGetInput } from "@still/shared/console";
import { previewExhibition } from "../../../services/console/preview";
import { consoleProcedure, router } from "../../init";

// console.preview.get (SPEC §9.4 미리보기와 발행 점검, Figma A4). Another institution's code is NOT_FOUND.
export const consolePreviewRouter = router({
  get: consoleProcedure.input(consolePreviewGetInput).query(({ ctx, input }) => previewExhibition(ctx.institutionId, input.code)),
});
