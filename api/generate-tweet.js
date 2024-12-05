import { Configuration, OpenAIApi } from "openai";

const openai = new OpenAIApi({
    apiKey: process.env.OPENAI_API_KEY, // Use your server-side environment variable
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { titles } = req.body;

  if (!titles || !Array.isArray(titles) || titles.length === 0) {
    return res.status(400).json({ message: "Invalid titles provided" });
  }

  try {
    const prompt = `
      Generate a concise and engaging tweet using the following news article titles:
      ${titles.join(", ")}.
      The tweet should summarize the theme in a compelling way and fit within 280 characters.
    `;
    const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt}],
        model: "text-davinci-003",
    });

    const tweet = chatCompletion.data.choices[0].text.trim();
    res.status(200).json({ tweet });
  } catch (error) {
    console.error("Error generating tweet:", error);
    res.status(500).json({ message: "Failed to generate tweet" });
  }
}