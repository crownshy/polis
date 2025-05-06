/** @jsx jsx */
import { Component } from 'react'
import { Box, Link, Heading, jsx } from 'theme-ui'

import emoji from 'react-easy-emoji'

class Header extends Component {
  render() {
    return (
      <Box sx={{ mt: [3, null, 4] }}>
        <Heading
          as="h3"
          sx={{ fontSize: [4], lineHeight: 'body', my: [2, null, 3] }}>
          Legal
        </Heading>
        <Box sx={{ mb: [2, null, 3], maxWidth: '30em' }}>
          Polis is built for the public with {emoji('❤️')} in Seattle{' '}
          {emoji('🇺🇸')}, with contributions from around the {emoji('🌍🌏🌎')}
        </Box>
        <Box>
          CrownShy operates a modified, unaffiliated version of the Polis code. All modifications
          to the original polis code base can be found at <a href="https://github.com/crownshy/polis">https://github.com/crownshy/polis</a>.
        </Box>
        <Box sx={{ mb: [2, null, 3] }}>
          © {new Date().getFullYear()} The Authors <Link href="tos">TOS</Link>{' '}
          <Link href="privacy">Privacy</Link>
        </Box>
      </Box>
    )
  }
}

export default Header
