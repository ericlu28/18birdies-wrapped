Stats aggregation of wrapped.
- add new method for "isFullRound" (18 holes of play)
- add new method for "is9holesRound" (9 holes of play)
- currently, wrapped summary includes all history from the start of time in JSON creation. change this to pass summarization from a passed in start date. For the wrapped purposes, we can default this to the new year 01/01/2025.

- Calendar Slide Feature
    - highlights on top of the page:
        - total rounds played over the calendar year
        - busiest couple of months
    - Calendar UI that displays the rounds played on a calendar, indicating particular months and weekends that had high activity.
        - when user hovers a month on the calendar, display the average of the month.


- Map Slide Feature enhancements
    - add a legend on the right-hand side of the slide that has the course name and a count of how many rounds have been played at it. 
        - when the pin is hovered on, we also highlight that course in the legend, and bring up above the pin a descriptor with the course name, rounds played, average score, best score, worst score.
