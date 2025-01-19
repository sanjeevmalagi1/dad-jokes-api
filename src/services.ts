import { Response, Request } from "express"
import { OpenAI } from "openai"

import AWS from "aws-sdk"

import Redis from "ioredis";
import crypto from "crypto";

const open_ai_api_key = process.env.OPEN_AI_API_KEY
const redis_host = process.env.REDIS_HOST || "127.0.0.1"
const redis_port = parseInt(process.env.REDIS_PORT || "6379", 10)
const redis_passward = process.env.REDIS_PASSWORD || ""

const redis = new Redis({
    port: redis_port,
    host: redis_host,
    username: "default",
    password: redis_passward,
    db: 0
});

const openai = new OpenAI({
    apiKey: open_ai_api_key
});

const lambda = new AWS.Lambda();
  
const UNIQUE_HASHES_SET = "unique_jokes_hashes";
const RANDOM_JOKES_ZSET = "random_jokes";
const IS_FETCHING_JOKES = "is_fetching_jokes";

/**
 * Compute SHA256 hash of a string.
 * @param {string} joke - The joke to hash.
 * @returns {string} - The SHA256 hash of the joke.
 */
function computeHash(joke: string): string {
    return crypto.createHash('sha256').update(joke).digest('hex');
}

/**
 * Add a joke to the Redis store.
 * @param {string} joke - The joke to add.
 * @returns {Promise<boolean>} - Returns true if the joke was added, false otherwise.
 */
export async function addJoke(joke: string) {
    const jokeHash = computeHash(joke);

    // Check if the hash already exists
    const exists = await redis.sismember(UNIQUE_HASHES_SET, jokeHash);
    if (exists) {
      return false;
    }
  
    // Add the hash to the unique set and the joke to the ZSET
    await redis.sadd(UNIQUE_HASHES_SET, jokeHash);
    const randomScore = Math.random(); // Generate a random score
    await redis.zadd(RANDOM_JOKES_ZSET, randomScore, joke);
  
    return true;
}

/**
 * Retrieve and delete a random joke from the Redis store.
 * @returns {Promise<string | null>} - The joke if one is found, otherwise null.
 */
export async function getRandomUnseenJoke(): Promise<string | null> {
  // Get a random joke

  const joke = await redis.zrandmember(RANDOM_JOKES_ZSET);
  if (!joke) {
    return null;
  }

  // Remove the joke from the ZSET
  await redis.zrem(RANDOM_JOKES_ZSET, joke);

  // Compute the hash and remove it from the deduplication set
  const jokeHash = computeHash(joke);
  await redis.srem(UNIQUE_HASHES_SET, jokeHash);

  return joke;
}

export async function getJokesCount(): Promise<number> {
    const jokesCount = await redis.zcard(RANDOM_JOKES_ZSET);
    return jokesCount || 0;
}

export async function getIsFetchingJokes(): Promise<boolean> {
    const isFetching = await redis.get(IS_FETCHING_JOKES);
    return isFetching === 'true';
}

export async function setIsFetchingJokes(isFetching: boolean): Promise<void> {
    const isFetchingBool = isFetching ? 'true' : 'false'
    await redis.set(IS_FETCHING_JOKES, isFetchingBool, 'EX', 10);
}

/**
 * Sends a JSON response to the client with the specified HTTP status code and response data.
 *
 * @param {Request} req - The Express request object, containing information about the HTTP request.
 * @param {Response} res - The Express response object, used to send a response back to the client.
 * @param {number} statusCode - The HTTP status code to be sent with the response.
 * @param {Object | Object[]} response - The data to be sent in the response body. If it's an array, the data will be wrapped under the `items` key; 
 *                                       otherwise, it will be wrapped under the `item` key.
 * @returns {Response} - The Express response object with the JSON payload.
 *
 * Example usage:
 * ```
 * json_response(req, res, 200, { name: "John Doe" });
 * json_response(req, res, 200, [{ name: "John Doe" }, { name: "Jane Doe" }]);
 * ```
 */
export const json_response = (req: Request, res: Response, statusCode: number, response: Object | Object[]): Response => {
    return res.status(statusCode).json({
        ...(Array.isArray(response) ? { items: response } : { item: response }),
        method: req.method,
    })
}

export interface IJoke {
    setup: string;
    punchline: string;
}

export const getJokesFromOpenAI = async () : Promise<IJoke[]> => {
    const topic = getRandomTopic()

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "developer", content: "Generate Dad jokes. Give your response in plain JSON (with emojies) (as an API) in the format of { jokes: [ setup: setup, puchline:  puchline ] } without ```json tags" },
        { role: "user", content: `Generate 10 unique dad jokes about ${topic}` }
      ],
      temperature: 0.7,
    });
  
    return parseJokes(response.choices[0].message.content);
}

export const parseJokes = (jsonResponse: string | null): IJoke[] => {
    if (jsonResponse) {
        const jokesData = JSON.parse(jsonResponse);
        return jokesData.jokes.map((joke: any) => ({ setup: joke.setup, punchline: joke.punchline }));
    }

    return []
}

export const invokeJokesUpdater = async () => {
    return await lambda.invoke({
        FunctionName: 'dad-jokes-api-dev-jokesUpdater',
        InvocationType: 'Event',
        Payload: ""
    }).promise()
}

const topics = [
    "comedy",
    "history",
    "coding",
    "fantasy",
    "animals",
    "chemistry",
    "technology",
    "languages",
    "futuristic gadgets",
    "festivals",
    "airplanes",
    "social media",
    "circus",
    "evolution",
    "farming",
    "bicycles",
    "board games",
    "ocean exploration",
    "castles",
    "finance",
    "riddles",
    "theme parks",
    "music",
    "ancient civilizations",
    "programming",
    "pirates",
    "quantum physics",
    "desserts",
    "espionage",
    "stand-up",
    "aliens",
    "roller coasters",
    "computers",
    "school life",
    "modern art",
    "wildlife",
    "crime",
    "science experiments",
    "magic",
    "space",
    "legends",
    "video games",
    "college life",
    "painting",
    "photography",
    "writing",
    "startups",
    "space travel",
    "history lessons",
    "cooking",
    "travel",
    "philosophy",
    "trains",
    "parenting",
    "chess",
    "education",
    "gardening",
    "hobbies",
    "puzzles",
    "dinosaurs",
    "movies",
    "fashion",
    "books",
    "rivers",
    "office pranks",
    "urban myths",
    "superstitions",
    "games",
    "artificial intelligence",
    "renaissance",
    "beaches",
    "architecture",
    "time travel",
    "spies",
    "nature",
    "villains",
    "cars",
    "psychology",
    "mountains",
    "online dating",
    "weather",
    "city life",
    "robots",
    "pets",
    "fables",
    "inventions",
    "astronomy"
  ];  

const getRandomTopic = () => {
    return topics[Math.floor(Math.random() * topics.length)];
}
