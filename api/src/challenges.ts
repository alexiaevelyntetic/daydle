// "Daydle of the day": one challenge per calendar day, the same for everyone (Wordle-style).
// An extension on top of the old app's contract: it lives on its own /daily routes and never
// changes what the original endpoints return unless the user actually completes a challenge.
import { daysBetween } from "./time.js";

export const DAILY_XP = 40;
/** Daydle #1 is this day. */
export const DAILY_EPOCH = "2026-01-01";

export const CHALLENGES: readonly string[] = [
  "Take a 10-minute walk without your phone",
  "Send someone a thank-you message",
  "Drink a glass of water before every meal",
  "Read 10 pages of a book",
  "Tidy one drawer or shelf",
  "Do 20 squats",
  "Write down three things you're grateful for",
  "Cook something you've never cooked before",
  "Go to bed 30 minutes earlier than usual",
  "Stretch for 5 minutes",
  "Call a friend you haven't spoken to in a while",
  "Spend an hour without social media",
  "Learn five words in a new language",
  "Unsubscribe from three newsletters you never read",
  "Take the stairs every time today",
  "Eat a piece of fruit you rarely eat",
  "Write a short note to your future self",
  "Clear your desk completely",
  "Meditate for 5 minutes",
  "Compliment a stranger",
  "Do a 15-minute digital clean-up of your files",
  "Listen to an album you've never heard, start to finish",
  "Plan tomorrow before you go to sleep",
  "Do 15 push-ups (knees count)",
  "Water your plants, or buy one",
  "Watch the sunset or the sunrise",
  "Delete 50 photos you don't need",
  "Write a review for a place you love",
  "Try a new route home",
  "Go outside for 20 minutes of daylight",
  "Do one task you've been putting off",
  "Draw something, however badly",
  "Back up your phone",
  "Make your bed as soon as you get up",
  "Hold a plank for one minute",
  "Learn how to do something new from a short video",
  "Give away one thing you no longer use",
  "Eat lunch away from any screen",
  "Write down one goal for this month",
  "Clean out your bag or wallet",
  "Send a voice message instead of a text",
  "Take 10 deep breaths, slowly",
  "Walk 8,000 steps",
  "Prepare a healthy snack for tomorrow",
  "Read an article on a topic you know nothing about",
  "Do a 5-minute kitchen reset",
  "Wake up without hitting snooze",
  "Write a to-do list on paper",
  "Ask someone how their day really was",
  "Spend 10 minutes learning a skill you want",
  "Put your phone in another room for an hour",
  "Fix one small thing that's broken",
  "Drink no sugary drinks today",
  "Write a poem of four lines",
  "Check your posture every hour",
  "Organise your browser tabs and bookmarks",
  "Do something kind without telling anyone",
  "Dance to one full song",
  "Look up a recipe and save it for the weekend",
  "End the day by writing one sentence about it",
];

export interface Challenge {
  day: string;
  number: number;
  title: string;
  xp: number;
}

/**
 * The challenge for a calendar day. Stepping through the list by 37 (coprime with 60) visits
 * every challenge once per cycle without neighbouring days getting neighbouring entries.
 */
export function challengeFor(day: string): Challenge {
  const n = daysBetween(DAILY_EPOCH, day);
  const len = CHALLENGES.length;
  const index = (((n * 37) % len) + len) % len;
  return { day, number: n + 1, title: CHALLENGES[index]!, xp: DAILY_XP };
}
