#include "Core/FGPlayerState.h"
#include "Net/UnrealNetwork.h"

AFGPlayerState::AFGPlayerState()
{
}

void AFGPlayerState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME(AFGPlayerState, TeamId);
	DOREPLIFETIME(AFGPlayerState, Kills);
	DOREPLIFETIME(AFGPlayerState, Deaths);
}

void AFGPlayerState::SetTeamId(int32 NewTeamId)
{
	check(HasAuthority());
	TeamId = NewTeamId;
}

void AFGPlayerState::AddKill()
{
	check(HasAuthority());
	++Kills;
}

void AFGPlayerState::AddDeath()
{
	check(HasAuthority());
	++Deaths;
}

void AFGPlayerState::OnRep_TeamId()
{
}
