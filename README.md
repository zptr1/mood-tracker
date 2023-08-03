# mood-tracker

A simple mood tracker site.

https://mood.zptr.cc/

## TODO

- [ ] Privacy Policy
- [ ] Settings
  * [ ] Profile Customization
    - [x] Change username / password
    - [x] Custom Mood Labels
    - [x] Custom Colors
    - [ ] oneko (cat follows mouse)
  * [x] Privacy Settings
    - [x] Make profile private
    - [x] Make mood history private
  * [x] Buttons!
    - [x] Clear mood history
    - [x] Download my data
    - [x] Delete the account
- [x] Charts/analytics on the profile
- [ ] API
  - [x] Fetching history (full or paginated)
  - [x] Deleting history record(s)
  - [ ] Webhooks: will make a POST request to the configured URL once the mood is updated. Will also support Discord webhooks
  - [x] Prometheus endpoint

### Internal
- [x] Split [`views/`](views) into `pages` and `partials`
- [ ] Refractor stuff because the current code structure is ugly

## Plans
This is planned but not yet in the TODO list.

- More privacy options
  * Make the profile private for fetching with an API - will still be viewable by others but bots won't be able to access it
  * Store the mood only locally using localStorage - unsure if I'll do this though, feels like this wouldn't be really useful
  * Limit the amount of days the mood history is stored up to (or disable the history at all)
- An option to change the font for your profile
- API stuff:
  * Documentation
  * OAuth
    - WebSocket API to retrieve real-time updates
- Discord Bot
  * Linking accounts
  * Viewing someones profile
  * Updating your own mood (unsure how to implement properly)
  * [Linked roles](https://discord.com/developers/docs/tutorials/configuring-app-metadata-for-linked-roles)
- Buy a domain for this thing if this ever becomes popular
