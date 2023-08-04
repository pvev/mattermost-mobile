// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import {of as of$} from 'rxjs';
import {switchMap} from 'rxjs/operators';

import {queryMyRecentChannels} from '@queries/servers/channel';
import {queryJoinedTeams} from '@queries/servers/team';
import {retrieveChannels} from '@screens/find_channels/utils';

import UnfilteredList from './unfiltered_list';

import type {WithDatabaseArgs} from '@typings/database/database';

const MAX_CHANNELS = 20;

const enhanced = withObservables([], ({database}: WithDatabaseArgs) => {
    const teamsCount = queryJoinedTeams(database).observeCount();
    const teamIds = queryJoinedTeams(database).observe().pipe(
        // eslint-disable-next-line max-nested-callbacks
        switchMap((teams) => of$(new Set(teams.map((t) => t.id)))),
    );

    const recentChannels = queryMyRecentChannels(database, MAX_CHANNELS).
        observeWithColumns(['last_viewed_at', 'teamId']).pipe(
            switchMap((myChannels) => retrieveChannels(database, myChannels, true)),

            // Filter the recentChannels by checking if the teamId exists in the Set of teamIds
            switchMap((recentChannels1) =>
                teamIds.pipe(
                    // eslint-disable-next-line max-nested-callbacks
                    switchMap((teamIdsSet) =>
                        // eslint-disable-next-line max-nested-callbacks
                        of$(recentChannels1.filter((channel) => {
                            if (!channel.teamId) {
                                return true;
                            }
                            return teamIdsSet.has(channel.teamId);
                        })),
                    ),
                ),
            ),
        );

    return {
        recentChannels,
        showTeamName: teamsCount.pipe(switchMap((count) => of$(count > 1))),
    };
});

export default withDatabase(enhanced(UnfilteredList));
