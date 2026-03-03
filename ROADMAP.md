# Roadmap

## Tweaks
- building info screen to appear in a in-window popup, that behaves like a desktop window - i.e movable, closeable
- Ability to adjust building quanitity in the "resource flows" building list.
- Ability to rename projecst and countries by double-clicking the text in the dropdown box, making it editable.

## Architecture review
- collect naming conventions from code and UI
    - align terms between UI and code. Interview me about direction or specific examples. Use industry conventions.
- Review file structure. I would like frontend modules to avoid monolithic files. Establish file structure conventions. Try split out shared functionality and promote component reuse.
    - Examples: 
        - splitting out the slider component for reuse
        - splitting out the project building quantity adjustment component
        - RBreaking up the large IncomeAnalysis jsx file into modules and folders.
- Review test structure and fixtures
    - get a view across all the tests, with an eye to making end-to-end tests on more realistic data.
    - test fixtures set up random dummy data, and we assert that the calculations are correct.
    

## Widget
- Alongside the Prices toolbar button, a debt calculator should be added. This takes two inputs - interest rate and loan period. This is a fixed-rate, fixed-term loan with constant repayments for the term. I would like it to then display:
    Inputs:
        - Interest rate: 0 - 5% range
        - Period - 0 - 5 year term
    Display:
        - Total amount to be repaid
        - Amount paid per year/month/week/day.
    Design:
        - Sliders for inputs, reusing the productivity slider.
        - Window behaves like a desktop window - movable, stays open until (x) pressed or toolbar button toggled
        - Minimal size window