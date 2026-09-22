export type WritingAction =
  | "GENERATE_BIO"
  | "SHORTEN_BIO"
  | "CHANGE_TONE"
  | "PROMOTER_BIO"
  | "FESTIVAL_BIO"
  | "BRAND_BIO"
  | "TRANSLATE"
  | "GRAMMAR_FIX"
  | "SEO_DESCRIPTION"
  | "CAREER_SUMMARY";
export interface AIProvider {
  generateText(request: {
    action: WritingAction;
    text: string;
    language: "en" | "ar";
    tone: string;
    userId: string;
  }): Promise<{ text: string; inputTokens: number; outputTokens: number }>;
}
