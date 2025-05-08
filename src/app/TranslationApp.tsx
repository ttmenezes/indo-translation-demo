"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowDownUp, Copy, Languages } from "lucide-react"

export default function TranslationApp() {
  const [sourceLanguage, setSourceLanguage] = useState("english")
  const [targetLanguage, setTargetLanguage] = useState("indonesian")
  const [translationMode, setTranslationMode] = useState("zero-shot")
  const [inputText, setInputText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const languages = [
    { id: "english", name: "English" },
    { id: "javanese", name: "Javanese" },
    { id: "indonesian", name: "Indonesian" },
  ]

  const translationModes = [
    { id: "zero-shot", name: "Zero-shot Translation" },
    { id: "many-shot", name: "Many-shot Translation" },
  ]

  const handleTranslate = async () => {
    if (!inputText) return;

    setIsLoading(true);
    setError(null);
    setTranslatedText("");

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputText,
          sourceLanguage,
          targetLanguage,
          translationMode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Translation failed");
      }

      const data = await response.json();
      setTranslatedText(data.translatedText);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setTranslatedText(""); // Clear previous translation on error
    } finally {
      setIsLoading(false);
    }
  };

  const swapLanguages = () => {
    const temp = sourceLanguage
    setSourceLanguage(targetLanguage)
    setTargetLanguage(temp)
    setTranslatedText("")
    setError(null);
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(translatedText)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="flex items-center justify-center mb-8 gap-2">
          <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-full shadow-sm">
            <Languages className="h-6 w-6 text-slate-700 dark:text-slate-300" />
          </div>
          <h1 className="text-2xl font-bold text-center">Translation App</h1>
        </div>

        <div className="grid gap-6">
          <div className="flex items-center gap-2 w-full">
            <div className="w-full flex-1">
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.id} value={lang.id}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={swapLanguages}
              className="rounded-full h-10 w-10 flex-shrink-0 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <ArrowDownUp className="h-4 w-4" />
              <span className="sr-only">Swap languages</span>
            </Button>

            <div className="w-full flex-1">
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.id} value={lang.id}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="w-full">
            <Select value={translationMode} onValueChange={setTranslationMode}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select translation mode" />
              </SelectTrigger>
              <SelectContent>
                {translationModes.map((mode) => (
                  <SelectItem key={mode.id} value={mode.id}>
                    {mode.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Textarea
                placeholder="Enter text to translate"
                className="min-h-[120px] border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </CardContent>
          </Card>

          <Button onClick={handleTranslate} className="w-full font-medium" disabled={!inputText || isLoading} size="lg">
            {isLoading ? "Translating..." : "Translate"}
          </Button>

          {error && (
            <Card className="mt-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Error</p>
                <p className="whitespace-pre-wrap text-red-700 dark:text-red-300">{error}</p>
              </CardContent>
            </Card>
          )}

          {translatedText && !error && (
            <Card className="mt-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300 animate-in fade-in-50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {languages.find((l) => l.id === targetLanguage)?.name}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyToClipboard}
                    className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy to clipboard</span>
                  </Button>
                </div>
                <p className="whitespace-pre-wrap text-lg">{translatedText}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
