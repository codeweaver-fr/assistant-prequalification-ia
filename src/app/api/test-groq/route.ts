import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { ProjectRequestSchema } from "@/lib/schemas/projectRequest";
import { getMissingFields } from "@/lib/business/getMissingFields";
import { getQuestionsForMissingFields } from "@/lib/business/getQuestionsForMissingFields";
import { getFieldsToClarify } from "@/lib/business/getFieldsToClarify";
import { getQuestionsForClarifications } from "@/lib/business/getQuestionsForClarifications";
import { mergeProjectRequest } from "@/lib/business/mergeProjectRequest";

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "GROQ_API_KEY manquante",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();

    const groq = new Groq({
      apiKey,
    });

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `
Tu es un moteur d'extraction de données pour la préqualification de demandes clients.

Analyse uniquement le nouveau message du prospect.

Retourne uniquement un JSON valide.

Format attendu :

{
  "projectType": string | null,
  "mainNeed": string | null,
  "location": string | null,
  "budget": {
    "status": "missing" | "unknown" | "provided" | "ambiguous",
    "min": number | null,
    "max": number | null
  },
  "deadline": string | null
}

Règles générales :
- N'invente aucune information.
- Extrais uniquement les informations présentes dans le nouveau message.
- Si une information n'est pas présente dans ce message, mets null quand le champ le permet.
- projectType doit être précis.
- mainNeed doit décrire concrètement le besoin.
- location doit reprendre uniquement une localisation explicitement mentionnée.
- deadline doit reprendre le délai exprimé sans l'inventer.

Règles pour le budget :
- "missing" si le nouveau message ne parle pas du tout de budget.
- "unknown" si le prospect dit qu'il ne sait pas.
- "provided" si un montant ou une fourchette exploitable est donné.
- "ambiguous" si le budget est évoqué de manière trop vague.
- Si un montant exact est donné, mets la même valeur dans min et max.
- Si une fourchette est donnée, mets la borne basse dans min et la borne haute dans max.
- N'invente jamais un montant.

Ne retourne aucun texte avant ou après le JSON.
          `,
        },
        {
          role: "user",
          content: body.message,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        {
          ok: false,
          error: "Réponse IA vide",
        },
        { status: 500 },
      );
    }

    const parsedContent = JSON.parse(content);

    const validation = ProjectRequestSchema.safeParse(parsedContent);

    if (!validation.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "La réponse IA ne respecte pas le format attendu.",
          details: validation.error.issues,
        },
        { status: 422 },
      );
    }

    let project = validation.data;

    if (body.currentProject) {
      const currentValidation = ProjectRequestSchema.safeParse(
        body.currentProject,
      );

      if (!currentValidation.success) {
        return NextResponse.json(
          {
            ok: false,
            error: "Les données actuelles du projet sont invalides.",
          },
          { status: 400 },
        );
      }

      project = mergeProjectRequest(currentValidation.data, validation.data);
    }

    const missingFields = getMissingFields(project);
    const fieldsToClarify = getFieldsToClarify(project);

    const missingQuestions = getQuestionsForMissingFields(missingFields);

    const clarificationQuestions =
      getQuestionsForClarifications(fieldsToClarify);

    return NextResponse.json({
      ok: true,
      data: project,
      missingFields,
      fieldsToClarify,
      questions: {
        missing: missingQuestions,
        clarification: clarificationQuestions,
      },
    });
  } catch (error) {
    console.error("Erreur Groq :", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erreur lors du traitement de la demande.",
      },
      { status: 500 },
    );
  }
}
