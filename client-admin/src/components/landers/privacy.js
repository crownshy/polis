// Copyright (C) 2012-present, The Authors. This program is free software: you can redistribute it and/or  modify it under the terms of the GNU Affero General Public License, version 3, as published by the Free Software Foundation. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <http://www.gnu.org/licenses/>.

import React from 'react'
import StaticLayout from './lander-layout'
import PrivacyContent from '../../content/privacy.md'

class Privacy extends React.Component {

  componentDidMount(){
    const script = document.createElement("script");
    script.src = "https://app.termly.io/embed-policy.min.js";
    script.async = true;
    document.body.appendChild(script);
  }
  render() {
    return (
      <StaticLayout>
       <div name="termly-embed" data-id="f172c6e1-6fa4-4542-8df3-70401e6f76e3"></div>
      </StaticLayout>
    )
  }
}

export default Privacy
