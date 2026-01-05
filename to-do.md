Stats aggregation of wrapped.
- add new method for "isFullRound" (18 holes of play)
- add new method for "is9holesRound" (9 holes of play)
- currently, wrapped summary includes all history from the start of time in JSON creation. change this to pass summarization from a passed in start date. For the wrapped purposes, we can default this to the new year 01/01/2025.



- Wrapped Features
    - Map of pins around the United States coming down of all courses played. 
        - Pins should be placed in time sequential order of when the course was first played that year. If a pin was already placed for that course, we can "grow the pin taller". 
    - requirements:
        - Map User Interface
        - searchmapping of golf course name/club ID to latitude/longitude value that the map UI can load to place the pins
        - parse through each of the rounds played in timestamp order, and drop pins or grow the pin correspondingly.
    - vendor:
        - OpenStreetMap: 
            - pro: free, simple node API
            - con: doesn't include many courses on search functionality.
        - Mapbox Geocoding API
            - pro: can use both geocoding search API and the map provider functionality.
            - cons: pay by usage.
            - URL: https://account.mapbox.com/auth/signup/?route-to=https://docs.mapbox.com/help/dive-deeper/access-tokens/
        - Google Geocoding API
            - pro: best search API from text -> place
            - most expensive



