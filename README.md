# Abstract vote automation

This workspace contains a small script that reproduces the contract call from:

`0xec5ab132acc0a581bf631f65cabb881760c092697bf0bb046cc3de1945572710`

## Transaction summary

- Chain: Abstract mainnet, chain id `2741`
- Target contract: `0x3b50de27506f0a8c1f4122a1e6f470009a76ce2a`
- Function: `voteForApp(uint256 appId)`
- Method id: `0x7060a227`
- Original argument: `appId = 15`
- Successful event: `Voted(voter, appId, epoch)`
- Original event values: voter `0x938813205d9e5d76b32dbafd48b428ab3eacbb2f`, appId `15`, epoch `329`

The original sender is a contract account, so it is an Abstract Global Wallet / smart-account transaction. Use `agw_vote.js` if you want the vote to come from your AGW.

## AGW usage

Install and link AGW CLI:

```bash
npm install -g @abstract-foundation/agw-cli
agw-cli auth init --json '{"chainId":2741}' --execute
agw-cli session status --json '{"fields":["status","readiness","accountAddress","policyPreset"]}'
```

Preview the vote:

```bash
node agw_vote.js --app-id 15 --dry-run
```

Execute after the preview looks correct:

```bash
node agw_vote.js --app-id 15 --execute
```

`agw_vote.js` reads `voteCost()`, `currentEpoch()`, and `userVotesRemaining(agw)` before it calls `agw-cli contract write`. The vote transaction includes the current `voteCost()` as `value`, because the on-chain `voteForApp(uint256)` function is payable.

List apps, list your votes, or randomly choose an unvoted app:

```bash
node agw_vote.js --list-apps
node agw_vote.js --list-votes
node agw_vote.js --random-vote --dry-run
node agw_vote.js --random-vote --execute
```
