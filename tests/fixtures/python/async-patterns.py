import asyncio


async def fetch_data(url: str) -> str:
    print("Fetching: " + url)
    await asyncio.sleep(1)
    return "response"


async def process_batch(items: list[str]) -> list[str]:
    results = []
    for item in items:
        result = await fetch_data(item)
        print("Got: " + result)
        results.append(result)
    return results


async def gather_results(urls: list[str]) -> list[str]:
    tasks = [fetch_data(url) for url in urls]
    results = await asyncio.gather(*tasks)
    print("All done")
    return list(results)


class AsyncService:
    def __init__(self, base_url: str):
        self.base_url = base_url

    async def get(self, path: str) -> str:
        url = self.base_url + path
        print("GET " + url)
        return await fetch_data(url)

    async def post(self, path: str, data: str) -> str:
        url = self.base_url + path
        print("POST " + url + " with " + data)
        return "created"
