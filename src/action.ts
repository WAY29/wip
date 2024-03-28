import * as core from '@actions/core'
import * as github from '@actions/github'
import { Util } from './util'

export namespace Action {
  export async function run() {
    try {
      const { context } = github

      const payload = context.payload.pull_request
      const action = context.payload.action!
      const actions = [
        'opened',
        'edited',
        'labeled',
        'unlabeled',
        'synchronize',
      ]

      if (payload && action && actions.includes(action)) {
        const title = (payload.title as string).toLowerCase()
        const labels = payload.labels
          ? payload.labels.map((x: any) => (x.name as string).toLowerCase())
          : []
        const blockingLabels = Util.getBlockingLabels()
        const blockingKeywords = Util.getBlockingKeywords()

        core.info(`Title: ${title}`)
        core.info(`Labels: ${labels.join(',')}`)
        core.info(`Blocking labels: ${blockingLabels.join(',')}`)
        core.info(`Blocking keywords: ${blockingKeywords.join(',')}`)

        const effected: {
          labels: string[]
          keywords: string[]
        } = {
          labels: [],
          keywords: [],
        }

        blockingLabels.forEach((bl) => {
          if (labels.includes(bl)) {
            effected.labels.push(bl)
          }
        })

        blockingKeywords.forEach((bk) => {
          if (title.includes(bk)) {
            effected.keywords.push(bk)
          }
        })

        const summarys: string[] = []

        if (effected.keywords.length) {
          summarys.push(
            `Blocking keywords in title: ${effected.keywords.join(', ')}`,
          )
        }

        if (effected.labels.length) {
          summarys.push(`Blocking labels: ${effected.labels.join(', ')}`)
        }

        const indicate =
          effected.keywords.length > 0
            ? `(Title contains "${effected.keywords[0]}")`
            : effected.labels.length > 0
            ? `(Label contains "${effected.labels[0]}")`
            : ''

        const isWip = summarys.length > 0
        const desc = isWip
          ? Util.getWIPDescription()
          : Util.getReadyDescription()
        const octokit = Util.getOctokit()
        await octokit.rest.repos.createCommitStatus({
          ...context.repo,
          sha: payload.head.sha,
          state: isWip ? 'pending' : 'success',
          context: Util.getContect(),
          target_url: Util.getTargetUrl(),
          description: desc + indicate,
        })

        if (isWip) {
          core.info(`${desc}\n${summarys.join('\n')}`)
          if (core.getInput('setFailed') === 'true') {
            core.setFailed(`${desc}\n${summarys.join('\n')}`)
          }
        }
      }
    } catch (e) {
      core.error(e)
      core.setFailed(e.message)
    }
  }
}
