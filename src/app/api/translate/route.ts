import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Gemini API Key not found. Please set the GEMINI_API_KEY environment variable.");
  // Not throwing an error here, but API calls will fail if key is missing.
}

// User-provided initialization pattern
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" }); 

// User-provided model name, or a common alternative
const modelName = 'gemini-1.5-flash-latest'; // Or user's 'gemini-2.0-flash-001'

interface TranslationRequestBody {
  inputText: string;
  sourceLanguage: string;
  targetLanguage: string;
  translationMode: string;
}

interface CsvRow {
  [key: string]: string;
}

async function callGeminiApi(text: string, sourceLang: string, targetLang: string, mode: string, examples?: CsvRow[]): Promise<string> {
  if (!GEMINI_API_KEY) {
    return "Error: Gemini API Key not configured.";
  }

  let fullPrompt = ""; // Will be a single string for the 'contents' field

  // print length of examples
  console.log("Length of examples:", examples?.length);

  if (mode === 'many-shot' && examples && examples.length > 0) {
    let exampleText = "";
    let exampleCount = 0;
    for (const ex of examples) {
      const sourceExample = ex[sourceLang];
      const targetExample = ex[targetLang];
      if (sourceExample && targetExample) {
        exampleText += `${sourceLang.charAt(0).toUpperCase() + sourceLang.slice(1)}: "${sourceExample}"\n${targetLang.charAt(0).toUpperCase() + targetLang.slice(1)}: "${targetExample}"\n\n`;
        exampleCount++;
      }
    }
    if (exampleCount > 0) {
      fullPrompt = `You are a helpful translation assistant. Translate the text from ${sourceLang} to ${targetLang}. Only return the translation, no other text.\n\nHere are ${exampleCount} examples of translations from ${sourceLang} to ${targetLang}:\n${exampleText}Based on these examples, now translate the following text accurately:\n${sourceLang.charAt(0).toUpperCase() + sourceLang.slice(1)}: "${text}"\n${targetLang.charAt(0).toUpperCase() + targetLang.slice(1)}:`;
    } else {
      fullPrompt = `You are a helpful translation assistant. Translate the following text from ${sourceLang} to ${targetLang}. Only return the translation, no other text.\n\n${sourceLang.charAt(0).toUpperCase() + sourceLang.slice(1)}: "${text}"\n${targetLang.charAt(0).toUpperCase() + targetLang.slice(1)}:`;
    }
  } else { 
    fullPrompt = `You are a helpful translation assistant. Translate the following text from ${sourceLang} to ${targetLang}. Only return the translation, no other text.\n\n${sourceLang.charAt(0).toUpperCase() + sourceLang.slice(1)}: "${text}"\n${targetLang.charAt(0).toUpperCase() + targetLang.slice(1)}:`;
  }
  
  console.log(`Constructed Prompt for Gemini (${mode}):\n${fullPrompt.substring(0, 500)}${fullPrompt.length > 500 ? '...' : ''}`);

  try {
    // User-provided API call pattern: ai.models.generateContent()
    // The `contents` field typically takes a string or an array of Content objects.
    // For a simple text prompt, a string should suffice.
    // If it requires a more structured Content object, this might need adjustment.
    const result = await ai.models.generateContent({ 
        model: modelName, 
        contents: fullPrompt, // Passing the single prompt string
        // Optional: Add safety settings if needed, structure might vary for this method
        // generationConfig: { ... }
        // safetySettings: [ ... ] 
    });
    
    // User example implies direct .text property on the response from ai.models.generateContent
    // const response = await ai.models.generateContent(...); console.log(response.text);
    // This might be specific to the version of @google/genai the user's example is from.
    // More commonly, it's result.response.text() or result.response.candidates[0]....text
    let translatedText = "";
    if (result && typeof (result as any).text === 'string') { // Check for direct .text string property
        translatedText = (result as any).text;
    } else if (result && result.response && typeof result.response.text === 'function') { // Standard path
        translatedText = result.response.text();
    } else if (result && result.response && result.response.candidates && result.response.candidates.length > 0 &&
               result.response.candidates[0].content && result.response.candidates[0].content.parts && result.response.candidates[0].content.parts.length > 0) {
      translatedText = result.response.candidates[0].content.parts.map((part: {text: string}) => part.text).join("");
    } else {
        console.error("Could not extract text from Gemini response:", JSON.stringify(result, null, 2));
        throw new Error("Invalid response structure from Gemini API");
    }
    
    console.log("Gemini API Response Text:", translatedText);
    return translatedText.trim();
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    const message = error.message || 'Unknown Gemini API error';
    if (error.statusDetails) {
        return `Error during translation: ${message} (Details: ${JSON.stringify(error.statusDetails)})`;
    }
    return `Error during translation: ${message}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TranslationRequestBody = await request.json();
    const { inputText, sourceLanguage, targetLanguage, translationMode } = body;

    if (!inputText || !sourceLanguage || !targetLanguage || !translationMode) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    let examples: CsvRow[] | undefined = undefined;

    if (translationMode === 'many-shot') {
      try {
        const csvFilePath = path.join(process.cwd(), 'public', 'train.csv');
        if (!fs.existsSync(csvFilePath)) {
          console.warn("train.csv not found at", csvFilePath);
          return NextResponse.json({ error: 'Training data not found for many-shot mode. Cannot proceed.' }, { status: 500 });
        }
        const fileContent = fs.readFileSync(csvFilePath, 'utf8');
        const parseResult = Papa.parse<CsvRow>(fileContent, {
          header: true,
          skipEmptyLines: true,
        });
        examples = parseResult.data;
        if (parseResult.errors.length > 0) {
            console.warn("CSV parsing errors:", parseResult.errors.map((err: any) => err.message).join("; ")); // Typed err
        }
      } catch (csvError: any) { // Typed error
        console.error("Error reading or parsing CSV for many-shot:", csvError);
        return NextResponse.json({ error: `Failed to load training data for many-shot mode: ${csvError.message}` }, { status: 500 });
      }
      if (!examples || examples.length === 0) {
        console.warn("No examples found after parsing CSV for many-shot mode. Check CSV content and headers.");
        return NextResponse.json({ error: 'No valid training examples found for many-shot mode.' }, { status: 500 });
      }
    }

    const translatedText = await callGeminiApi(inputText, sourceLanguage, targetLanguage, translationMode, examples);
    
    if (translatedText.startsWith("Error:")) {
        return NextResponse.json({ error: translatedText }, { status: 500 });
    }

    return NextResponse.json({ translatedText });
  } catch (error: any) { // Typed error
    console.error('Translation API error (outer try-catch): ', error);
    const errorMessage = error.message || 'Failed to translate text (unknown server error)';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 