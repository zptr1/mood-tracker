# mood-tracker

A simple mood tracker site.

https://mood.zptr.cc/

## TODO

- [x] Privacy Policy
- [ ] Settings
  * [ ] Profile Customization
    - [x] Change username / password
    - [x] Custom Mood Labels
    - [x] Custom Colors
    - [x] Custom Font Size
    - [ ] Custom Font Family
    - [ ] oneko (cat follows mouse)
  * [x] Privacy Settings
    - [x] Make profile private
    - [x] Make mood history private
    - [x] Limit the amount of days the mood history is stored up to (or disable the history at all)
  * [x] Buttons!
    - [x] Clear mood history
    - [x] Download my data
    - [x] Delete the account
- [x] Charts/analytics on the profile
- [ ] API
  - [x] Fetching history (full or paginated)
  - [x] Deleting history record(s)
  - [ ] Webhooks: will make a POST request to the configured URL once the mood is updated. Will also support Discord webhooks
  - [ ] OAuth
  - [x] Prometheus endpoint
  - [ ] Documentation

### Internal
- [x] Split [`views/`](views) into `pages` and `partials`
- [ ] Refractor stuff because the current code structure is ugly
- [ ] Make a library for interacting with the API; use it in the client as well

## Plans
This is planned but not yet in the TODO list.

- More privacy options
  * Make the profile private for fetching with an API - will still be viewable by others but bots won't be able to access it
  * Store the mood only locally using localStorage - unsure if I'll do this though, feels like this wouldn't be really useful
- API stuff:
  * WebSocket API to retrieve real-time updates for OAuth
- Discord Bot
  * Linking accounts
  * Viewing someones profile
  * Updating your own mood (unsure how to implement properly)
  * [Linked roles](https://discord.com/developers/docs/tutorials/configuring-app-metadata-for-linked-roles)
- Buy a domain for this thing if this ever becomes popular
