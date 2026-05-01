import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    // Get local data (fallback if no DB)
    let userData = null

    if (typeof window === "undefined") {
      // server side fallback
      userData = "No local data available"
    }

    // Basic AI logic (temporary working version)
    const lastMessage = messages[messages.length - 1]?.content || ""

    let reply = ""

    if (lastMessage.toLowerCase().includes("spending")) {
      reply = "Based on your recent activity, you should monitor your food and shopping expenses."
    } else if (lastMessage.toLowerCase().includes("buy")) {
      reply = "This purchase seems reasonable, but ensure it fits your monthly budget."
    } else {
      reply = "I can help analyze your spending, detect habits, and guide your financial decisions."
    }

    return NextResponse.json({
      text: reply,
    })

  } catch (error) {
    console.error("Chat Error:", error)

    return NextResponse.json({
      text: "Something went wrong. Please try again.",
    })
  }
}