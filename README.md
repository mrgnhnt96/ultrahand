# ultrahand

A Claude Code plugin with research-backed UX design skills for each screen size, built as interactive, resizable Claude artifacts, plus a UX review skill.

## Install

Add the `mrgnhnt96` marketplace, then install the plugin:

```sh
claude plugin marketplace add mrgnhnt96/<marketplace-repo>
claude plugin install ultrahand@mrgnhnt96
```

## Skills

| Skill | Use it for |
| --- | --- |
| `ultrahand:mobile` | Designing phone UI screens and flows, with mobile size presets |
| `ultrahand:tablet` | Designing tablet UI, including split view |
| `ultrahand:desktop` | Designing desktop UI with free window resize and min/max bounds |
| `ultrahand:review` | Reviewing an existing UI against cited UX research |

Skills only trigger on UI design or UX review requests.

## Status

Skeleton only: skill bodies, the shared artifact canvas (`shared/`) and the research citations are still to come.

## License

MIT
