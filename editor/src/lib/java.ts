/** @deprecated Use @/lib/languages instead */
export {
  extractPublicClassName,
  getLanguage,
} from "./languages";

export { LANGUAGES as DEFAULT_SAMPLES } from "./languages";

import { getLanguage } from "./languages";

export const DEFAULT_JAVA_CODE = getLanguage("java").sample;
