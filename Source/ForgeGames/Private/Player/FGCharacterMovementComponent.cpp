#include "Player/FGCharacterMovementComponent.h"
#include "GameFramework/Character.h"

/** Carries the sprint/slide input flags through client prediction and reconciliation. */
class FSavedMove_FGCharacter : public FSavedMove_Character
{
public:
	typedef FSavedMove_Character Super;

	uint8 bSavedWantsToSprint : 1;
	uint8 bSavedWantsToSlide : 1;

	FSavedMove_FGCharacter()
		: bSavedWantsToSprint(0)
		, bSavedWantsToSlide(0)
	{
	}

	virtual void Clear() override
	{
		Super::Clear();
		bSavedWantsToSprint = 0;
		bSavedWantsToSlide = 0;
	}

	virtual uint8 GetCompressedFlags() const override
	{
		uint8 Result = Super::GetCompressedFlags();
		if (bSavedWantsToSprint)
		{
			Result |= FLAG_Custom_0;
		}
		if (bSavedWantsToSlide)
		{
			Result |= FLAG_Custom_1;
		}
		return Result;
	}

	virtual bool CanCombineWith(const FSavedMovePtr& NewMovePtr, ACharacter* InCharacter, float MaxDelta) const override
	{
		const FSavedMove_FGCharacter* NewMove = static_cast<FSavedMove_FGCharacter*>(NewMovePtr.Get());
		if (bSavedWantsToSprint != NewMove->bSavedWantsToSprint || bSavedWantsToSlide != NewMove->bSavedWantsToSlide)
		{
			return false;
		}
		return Super::CanCombineWith(NewMovePtr, InCharacter, MaxDelta);
	}

	virtual void SetMoveFor(ACharacter* C, float InDeltaTime, FVector const& NewAccel, FNetworkPredictionData_Client_Character& ClientData) override
	{
		Super::SetMoveFor(C, InDeltaTime, NewAccel, ClientData);

		if (UFGCharacterMovementComponent* MoveComp = C ? Cast<UFGCharacterMovementComponent>(C->GetCharacterMovement()) : nullptr)
		{
			bSavedWantsToSprint = MoveComp->WantsToSprint();
			bSavedWantsToSlide = MoveComp->WantsToSlide();
		}
	}
};

class FNetworkPredictionData_Client_FGCharacter : public FNetworkPredictionData_Client_Character
{
public:
	explicit FNetworkPredictionData_Client_FGCharacter(const UCharacterMovementComponent& ClientMovement)
		: FNetworkPredictionData_Client_Character(ClientMovement)
	{
	}

	virtual FSavedMovePtr AllocateNewMove() override
	{
		return FSavedMovePtr(new FSavedMove_FGCharacter());
	}
};

UFGCharacterMovementComponent::UFGCharacterMovementComponent()
{
}

float UFGCharacterMovementComponent::GetMaxSpeed() const
{
	float Speed = Super::GetMaxSpeed();

	if (MovementMode == MOVE_Walking && bWantsToSprint && !bWantsToSlide)
	{
		Speed *= SprintSpeedMultiplier;
	}

	return Speed;
}

void UFGCharacterMovementComponent::UpdateFromCompressedFlags(uint8 Flags)
{
	Super::UpdateFromCompressedFlags(Flags);

	bWantsToSprint = (Flags & FSavedMove_Character::FLAG_Custom_0) != 0;

	const bool bNewWantsToSlide = (Flags & FSavedMove_Character::FLAG_Custom_1) != 0;
	SetWantsToSlide(bNewWantsToSlide);
}

FNetworkPredictionData_Client* UFGCharacterMovementComponent::GetPredictionData_Client() const
{
	if (!ClientPredictionData)
	{
		UFGCharacterMovementComponent* MutableThis = const_cast<UFGCharacterMovementComponent*>(this);
		MutableThis->ClientPredictionData = new FNetworkPredictionData_Client_FGCharacter(*this);
	}
	return ClientPredictionData;
}

void UFGCharacterMovementComponent::SetWantsToSprint(bool bNewSprint)
{
	bWantsToSprint = bNewSprint;
}

void UFGCharacterMovementComponent::SetWantsToSlide(bool bNewSlide)
{
	if (bNewSlide && !bWantsToSlide && CanSlide())
	{
		bWantsToSlide = true;
		EnterSlide();
	}
	else if (!bNewSlide && bWantsToSlide)
	{
		bWantsToSlide = false;
		if (MovementMode == MOVE_Custom && CustomMovementMode == static_cast<uint8>(EFGCustomMovementMode::Slide))
		{
			ExitSlide();
		}
	}
}

bool UFGCharacterMovementComponent::CanSlide() const
{
	return MovementMode == MOVE_Walking && Velocity.SizeSquared2D() >= FMath::Square(MaxWalkSpeed * SlideMinSpeedFraction);
}

void UFGCharacterMovementComponent::EnterSlide()
{
	SlideTimeRemaining = SlideDuration;
	Velocity += Velocity.GetSafeNormal2D() * (MaxWalkSpeed * (SlideSpeedBoost - 1.f));
	SetMovementMode(MOVE_Custom, static_cast<uint8>(EFGCustomMovementMode::Slide));
}

void UFGCharacterMovementComponent::ExitSlide()
{
	SetMovementMode(MOVE_Walking);
}

void UFGCharacterMovementComponent::PhysCustom(float deltaTime, int32 Iterations)
{
	if (CustomMovementMode == static_cast<uint8>(EFGCustomMovementMode::Slide))
	{
		PhysSlide(deltaTime, Iterations);
		return;
	}

	Super::PhysCustom(deltaTime, Iterations);
}

void UFGCharacterMovementComponent::PhysSlide(float deltaTime, int32 Iterations)
{
	SlideTimeRemaining -= deltaTime;

	if (SlideTimeRemaining <= 0.f || Velocity.SizeSquared2D() < FMath::Square(MaxWalkSpeed * 0.2f))
	{
		bWantsToSlide = false;
		ExitSlide();
		StartNewPhysics(deltaTime, Iterations);
		return;
	}

	Velocity -= Velocity.GetSafeNormal() * (GroundFriction * 0.5f * deltaTime);

	FHitResult Hit;
	SafeMoveUpdatedComponent(Velocity * deltaTime, UpdatedComponent->GetComponentQuat(), true, Hit);

	if (Hit.IsValidBlockingHit())
	{
		HandleImpact(Hit, deltaTime, Velocity * deltaTime);
		SlideAlongSurface(Velocity * deltaTime, 1.f - Hit.Time, Hit.Normal, Hit, true);
	}
}
