#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "FGCharacter.generated.h"

class UFGCharacterMovementComponent;
class UFGInventoryComponent;
class UInputAction;
class UInputMappingContext;
struct FInputActionValue;

UCLASS()
class FORGEGAMES_API AFGCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AFGCharacter(const FObjectInitializer& ObjectInitializer);

	UFUNCTION(BlueprintPure, Category = "ForgeGames|Movement")
	UFGCharacterMovementComponent* GetFGMovementComponent() const { return FGMovementComponent; }

	UFUNCTION(BlueprintPure, Category = "ForgeGames|Inventory")
	UFGInventoryComponent* GetInventoryComponent() const { return InventoryComponent; }

	virtual float TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

protected:
	virtual void BeginPlay() override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	void Input_Move(const FInputActionValue& Value);
	void Input_Look(const FInputActionValue& Value);
	void Input_Jump();
	void Input_SprintStart();
	void Input_SprintStop();
	void Input_SlideStart();
	void Input_SlideStop();

	/** Server-only: notifies the game mode of the elimination and destroys the pawn. */
	void Eliminate(AController* KillerController);

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Input")
	TObjectPtr<UInputMappingContext> DefaultMappingContext;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Input")
	TObjectPtr<UInputAction> MoveAction;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Input")
	TObjectPtr<UInputAction> LookAction;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Input")
	TObjectPtr<UInputAction> JumpAction;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Input")
	TObjectPtr<UInputAction> SprintAction;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Input")
	TObjectPtr<UInputAction> SlideAction;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Combat")
	float MaxHealth = 100.f;

	UPROPERTY(ReplicatedUsing = OnRep_Health, BlueprintReadOnly, Category = "ForgeGames|Combat")
	float Health = 100.f;

	UFUNCTION()
	void OnRep_Health();

private:
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	UPROPERTY(VisibleAnywhere, Category = "ForgeGames|Inventory")
	TObjectPtr<UFGInventoryComponent> InventoryComponent;

	TObjectPtr<UFGCharacterMovementComponent> FGMovementComponent;
};
