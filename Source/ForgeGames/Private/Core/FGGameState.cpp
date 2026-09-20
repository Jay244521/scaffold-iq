#include "Core/FGGameState.h"
#include "Net/UnrealNetwork.h"

AFGGameState::AFGGameState()
{
}

void AFGGameState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME(AFGGameState, TeamScores);
	DOREPLIFETIME(AFGGameState, MatchPhase);
	DOREPLIFETIME(AFGGameState, TacticalPreviewEndServerTime);
}

int32 AFGGameState::GetTeamScore(int32 TeamId) const
{
	for (const FFGTeamScore& Entry : TeamScores)
	{
		if (Entry.TeamId == TeamId)
		{
			return Entry.Score;
		}
	}
	return 0;
}

void AFGGameState::RegisterTeam(int32 TeamId)
{
	check(HasAuthority());

	for (const FFGTeamScore& Entry : TeamScores)
	{
		if (Entry.TeamId == TeamId)
		{
			return;
		}
	}

	FFGTeamScore NewEntry;
	NewEntry.TeamId = TeamId;
	NewEntry.Score = 0;
	TeamScores.Add(NewEntry);
}

void AFGGameState::AddTeamScore(int32 TeamId, int32 Points)
{
	check(HasAuthority());

	for (FFGTeamScore& Entry : TeamScores)
	{
		if (Entry.TeamId == TeamId)
		{
			Entry.Score += Points;
			return;
		}
	}

	FFGTeamScore NewEntry;
	NewEntry.TeamId = TeamId;
	NewEntry.Score = Points;
	TeamScores.Add(NewEntry);
}

void AFGGameState::SetMatchPhase(EFGMatchPhase NewPhase)
{
	check(HasAuthority());
	MatchPhase = NewPhase;
	OnMatchPhaseChanged(MatchPhase);
}

void AFGGameState::OnRep_TeamScores()
{
}

void AFGGameState::OnRep_MatchPhase()
{
	OnMatchPhaseChanged(MatchPhase);
}
