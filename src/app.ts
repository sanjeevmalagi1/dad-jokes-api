import express, { Request, Response } from "express"
import AWS  from "aws-sdk"
const lambda = new AWS.Lambda();

const app = express()

import {
    json_response,
    addJoke,
    getJokesFromOpenAI,
    getRandomUnseenJoke,
    IJoke,
    getJokesCount,
    getIsFetchingJokes,
    setIsFetchingJokes,
    invokeJokesUpdater
} from "./services";

app.get('/api/v1/joke', async (req: Request, res: Response) => {
    const jokeJSON = await getRandomUnseenJoke()

    if (!jokeJSON) {
        json_response(req, res, 500, { message: "Joke not found" })
        return
    }

    await invokeJokesUpdater()

    json_response(req, res, 200, { joke: JSON.parse(jokeJSON) })
})

app.post('/api/v1/joke', async (req: Request, res: Response) => {

    const jokesCount = await getJokesCount();
    const isFetching = await getIsFetchingJokes();

    console.log({ isFetching, jokesCount });
    
    if (jokesCount > 5 || isFetching) {
        json_response(req, res, 200, { message: "Jokes already present" });
        return;
    }
    
    await setIsFetchingJokes(true);
    const jokes = await getJokesFromOpenAI()

    const jokePromises = jokes.map(async (joke: IJoke) => {
        const jokeString = JSON.stringify(joke)
        return addJoke(jokeString)
    })

    const insertJokeResults = await Promise.all(jokePromises)
    console.log({ insertJokeResults });
    await setIsFetchingJokes(false);
    
    json_response(req, res, 200, { message: "Jokes added" })
})

export default app
  