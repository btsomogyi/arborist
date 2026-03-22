# Nested structures with various indentation levels
class Processor:
    def __init__(self, items):
        self.items = items
        self.results = []

    def process(self):
        for item in self.items:
            if item > 0:
                result = item * 2
                self.results.append(result)
            else:
                print("Skipping negative: " + str(item))

    def summarize(self):
        total = sum(self.results)
        print("Total: " + str(total))
        return total


# Function with nested conditionals
def classify(value):
    if value > 100:
        category = "high"
        if value > 1000:
            category = "very_high"
    elif value > 0:
        category = "positive"
    else:
        category = "non_positive"
    return category


# List comprehension and multi-line string
def transform(items):
    doubled = [x * 2 for x in items if x > 0]
    message = """
    Processed items:
    Count: {}
    """.format(len(doubled))
    print(message)
    return doubled
