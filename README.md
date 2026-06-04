# AGW 自动投票脚本

这个脚本用于控制 Abstract Global Wallet（AGW）在 Abstract Portal 投票合约中进行 vote。

脚本支持：

- 查询当前 AGW 钱包地址
- 查询当前 epoch
- 查询剩余票数
- 查询当前 epoch 已经投过哪些 appId
- 查询 Portal appId 列表
- 指定 appId 投票
- 随机选择一个当前 epoch 没投过的 appId 投票
- dry-run 预览，不上链
- execute 真正执行，上链投票

## 依赖环境

需要先安装 Node.js 和 npm：

```bash
node -v
npm -v
```

安装脚本依赖：

```bash
npm install ethers
```

安装 AGW CLI：

```bash
npm install -g @abstract-foundation/agw-cli
```

## 激活 AGW CLI Session

第一次使用前，需要让 CLI 连接你的 AGW 钱包：

```bash
agw-cli auth init --json '{"chainId":2741}' --execute
```

这个命令会打开浏览器，让你登录并确认授权 AGW。

它的作用是创建本机 AGW session，不是导出私钥，也不是创建新钱包。

检查 session 状态：

```bash
agw-cli session status --json '{}'
```

如果 session 失效，可以重新执行：

```bash
agw-cli auth init --json '{"chainId":2741}' --execute
```

如果想撤销授权：

```bash
agw-cli auth revoke --json '{}' --execute
```

## 基础使用

查看帮助：

```bash
node agw_vote.js --help
```

查询当前 AGW 已经投过哪些 appId：

```bash
node agw_vote.js --list-votes
```

查询指定 epoch 已经投过哪些 appId：

```bash
node agw_vote.js --list-votes --epoch 329
```

查询 Portal appId 列表：

```bash
node agw_vote.js --list-apps
```

## 指定 appId 投票

先 dry-run 预览：

```bash
node agw_vote.js --app-id 15 --dry-run
```

确认没问题后执行：

```bash
node agw_vote.js --app-id 15 --execute
```

注意：

- `--dry-run` 只是预览，不会上链
- `--execute` 才会真正投票
- 不加 `--execute` 时，默认相当于 dry-run

## 随机投票

随机选择一个当前 epoch 没投过的 appId，并预览：

```bash
node agw_vote.js --random-vote --dry-run
```

随机选择一个当前 epoch 没投过的 appId，并真正执行：

```bash
node agw_vote.js --random-vote --execute
```

随机逻辑不是 AGW CLI 自带的，是脚本自己实现的：

1. 读取当前 AGW 地址
2. 调用合约 `getUserVotes(address, epoch)` 获取已投 appId
3. 通过 `agw-cli app list` 获取 Portal app 列表
4. 过滤掉已经投过的 appId
5. 从剩余 appId 中随机选一个
6. 调用 `voteForApp(appId)`

## 常用参数

```bash
--app-id <id>
```

指定要投的 appId。

```bash
--random-vote
```

随机选择一个当前 epoch 没投过的 appId。

```bash
--list-votes
```

只查询当前 AGW 已投过的 appId，不投票。

```bash
--list-apps
```

列出 Portal appId 列表。

```bash
--epoch <id>
```

查询指定 epoch 的投票记录。

```bash
--dry-run
```

预览交易，不执行。

```bash
--execute
```

真正执行交易。

```bash
--rpc <url>
```

指定 Abstract RPC。

默认 RPC：

```text
https://api.mainnet.abs.xyz
```

如果默认 RPC 超时，可以换成自己的 RPC：

```bash
node agw_vote.js --list-votes --rpc "https://abstract-mainnet.g.alchemy.com/v2/YOUR_KEY"
```

```bash
--cli <path>
```

指定 AGW CLI 路径。

如果系统找不到 `agw-cli`，可以这样：

```bash
node agw_vote.js --list-votes --cli "C:\Users\你的用户名\AppData\Roaming\npm\agw-cli.cmd"
```

## 重要说明

这个脚本不会保存私钥。

真正签名和发送交易的是 AGW CLI session。

`agw-cli auth init` 创建的是本机授权 session，不是永久私钥授权。session 可能会失效，也可以手动 revoke。

投票合约地址：

```text
0x3b50de27506f0a8c1f4122a1e6f470009a76ce2a
```

调用函数：

```solidity
voteForApp(uint256 appId)
```

查询已投 appId：

```solidity
getUserVotes(address user, uint256 epoch)
```

查询剩余票数：

```solidity
userVotesRemaining(address user)
```

查询当前 epoch：

```solidity
currentEpoch()
```

## 常见问题

### 1. preview 是不是投票成功？

不是。

如果返回：

```json
{
  "preview": true,
  "requiresExplicitExecute": true
}
```

说明只是预览成功，没有上链。

需要执行：

```bash
node agw_vote.js --app-id 15 --execute
```

### 2. 出现 RPC timeout 怎么办？

说明 Abstract RPC 暂时连不上或网络不稳定。

可以重试，或者换 RPC：

```bash
node agw_vote.js --list-votes --rpc "你的RPC地址"
```

### 3. 出现 Cannot find agw-cli 怎么办？

说明系统找不到 AGW CLI。

先安装：

```bash
npm install -g @abstract-foundation/agw-cli
```

或者用 `--cli` 指定完整路径。

### 4. AGW session 过期怎么办？

重新授权：

```bash
agw-cli auth init --json '{"chainId":2741}' --execute
```
