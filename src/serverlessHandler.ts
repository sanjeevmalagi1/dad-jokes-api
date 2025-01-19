
import serverless from "serverless-http"
import app from "./app"
import { addJoke, getIsFetchingJokes, getJokesCount, getJokesFromOpenAI, IJoke, setIsFetchingJokes } from "./services";

const api = serverless(app)

const jokesUpdater = async () => {
    const jokesCount = await getJokesCount();
    const isFetching = await getIsFetchingJokes();
    
    if (jokesCount > 5 || isFetching) {
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

    return;
}

export {
    api,
    jokesUpdater
}
