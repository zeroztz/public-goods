var comprehension = {
    questions: [{
        legend: "Question 1",
        description: "In a given segment of the study, how many times will each participant interact with every other participant?",
        name: "q1",
        options: {
            a: "0",
            b: "1",
            c: "3",
            d: "5"
        },
        correctOption: "c"
    }, {
        legend: "Question 2",
        description: "How many points are allotted to each participant at the beginning of each round?",
        name: "q2",
        options: {
            a: "0",
            b: "10",
            c: "20",
            d: "30"
        },
        correctOption: "idk"
    }]
}

// TODO(zeroztz): Add sanity check before export.
// TODO(zeroztz): Add entries for other comprehension tests.

module.exports = comprehension;
